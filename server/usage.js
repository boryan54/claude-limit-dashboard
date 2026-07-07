// Историческая статистика по моделям: инкрементальный скан JSONL транскриптов.
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import { normalizeModel, estimateCost } from './pricing.js';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');

// filepath -> { mtimeMs, size, records: [] }
const fileCache = new Map();
let scanning = null;

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (e.isFile() && e.name.endsWith('.jsonl')) {
      out.push(full);
    }
  }
  return out;
}

// Имя проекта: cwd из записи, иначе имя папки проекта под projects/.
function projectDirName(filepath) {
  // .../projects/<projectDir>/<...>.jsonl  или .../<projectDir>/subagents/x.jsonl
  const rel = filepath.slice(PROJECTS_DIR.length + 1);
  const firstSep = rel.search(/[\\/]/);
  return firstSep === -1 ? rel : rel.slice(0, firstSep);
}

function parseFile(content, fallbackProject) {
  const records = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line || line.charCodeAt(0) !== 123 /* '{' */) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.type !== 'assistant') continue;
    const msg = obj.message;
    const u = msg?.usage;
    if (!u) continue;
    const ts = obj.timestamp;
    if (!ts) continue;
    records.push({
      ts,
      day: ts.slice(0, 10), // YYYY-MM-DD (UTC из ISO)
      model: normalizeModel(msg.model),
      project: obj.cwd || fallbackProject,
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      cacheWrite: u.cache_creation_input_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0,
      dedup: (msg.id || obj.uuid || '') + '|' + (obj.requestId || ''),
    });
  }
  return records;
}

async function refreshFile(filepath) {
  let st;
  try {
    st = await stat(filepath);
  } catch {
    fileCache.delete(filepath);
    return;
  }
  const cached = fileCache.get(filepath);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) return;
  let content;
  try {
    content = await readFile(filepath, 'utf8');
  } catch {
    return;
  }
  const records = parseFile(content, projectDirName(filepath));
  fileCache.set(filepath, { mtimeMs: st.mtimeMs, size: st.size, records });
}

/** Полное/инкрементальное обновление кэша. Безопасно вызывать многократно. */
export async function refresh() {
  if (scanning) return scanning;
  scanning = (async () => {
    const files = await walk(PROJECTS_DIR);
    const present = new Set(files);
    // Удаляем из кэша исчезнувшие файлы
    for (const key of fileCache.keys()) if (!present.has(key)) fileCache.delete(key);
    // Обновляем изменённые
    await Promise.all(files.map((f) => refreshFile(f)));
  })();
  try {
    await scanning;
  } finally {
    scanning = null;
  }
}

function emptyBucket() {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, messages: 0, cost: 0 };
}
// Аккумулируем стоимость по каждой записи, т.к. цена зависит от модели.
function addInto(bucket, r) {
  bucket.input += r.input;
  bucket.output += r.output;
  bucket.cacheWrite += r.cacheWrite;
  bucket.cacheRead += r.cacheRead;
  bucket.messages += 1;
  bucket.cost += estimateCost(r.model, r);
}
function totalTokens(b) {
  return b.input + b.output + b.cacheWrite + b.cacheRead;
}

/**
 * Агрегация за диапазон [from, to] (включительно, YYYY-MM-DD). Пустые границы = без ограничения.
 * granularity: 'day' (по умолчанию) | 'hour' — почасовая разбивка (для одного дня).
 */
export async function aggregate({ from, to, granularity } = {}) {
  await refresh();
  const hourly = granularity === 'hour';

  const byModel = new Map();
  const byProject = new Map();
  const seriesMap = new Map(); // bucketKey -> Map(model -> bucket)
  if (hourly) for (let h = 0; h < 24; h++) seriesMap.set(String(h).padStart(2, '0'), new Map());
  const seen = new Set();
  const totals = emptyBucket();

  for (const { records } of fileCache.values()) {
    for (const r of records) {
      if (from && r.day < from) continue;
      if (to && r.day > to) continue;
      // Дедуп: одинаковые message.id+requestId встречаются при резюме/копии сессий
      if (r.dedup !== '|') {
        if (seen.has(r.dedup)) continue;
        seen.add(r.dedup);
      }

      if (!byModel.has(r.model)) byModel.set(r.model, emptyBucket());
      addInto(byModel.get(r.model), r);

      if (!byProject.has(r.project)) byProject.set(r.project, emptyBucket());
      addInto(byProject.get(r.project), r);

      const key = hourly ? (r.ts ? r.ts.slice(11, 13) : '00') : r.day;
      if (!seriesMap.has(key)) seriesMap.set(key, new Map());
      const dm = seriesMap.get(key);
      if (!dm.has(r.model)) dm.set(r.model, emptyBucket());
      addInto(dm.get(r.model), r);

      addInto(totals, r);
    }
  }

  const byModelArr = [...byModel.entries()]
    .map(([model, b]) => ({ model, ...b, tokens: totalTokens(b) }))
    .sort((a, b) => b.tokens - a.tokens);

  const byProjectArr = [...byProject.entries()]
    .map(([project, b]) => ({ project, ...b, tokens: totalTokens(b) }))
    .sort((a, b) => b.tokens - a.tokens);

  const daily = [...seriesMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, dm]) => {
      const perModel = {};
      for (const [model, b] of dm.entries()) {
        perModel[model] = { tokens: totalTokens(b), cost: estimateCost(model, b) };
      }
      return { date: hourly ? `${key}:00` : key, label: hourly ? `${key}:00` : key.slice(5), perModel };
    });

  return {
    range: { from: from || null, to: to || null, granularity: hourly ? 'hour' : 'day' },
    totals: { ...totals, tokens: totalTokens(totals) },
    byModel: byModelArr,
    byProject: byProjectArr,
    daily,
    files: fileCache.size,
  };
}
