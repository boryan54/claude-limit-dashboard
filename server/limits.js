// Живые лимиты подписки: запрос к oauth/usage с fallback на кэш statusline.
import { readFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const CREDS_PATH = join(homedir(), '.claude', '.credentials.json');
// Кэш, который пишет refresh-usage-cache.sh (на Windows через Git Bash /tmp -> см. TMP)
const CACHE_CANDIDATES = [
  '/tmp/claude/statusline-usage-cache.json',
  join(tmpdir(), 'claude', 'statusline-usage-cache.json'),
];
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

let memo = { data: null, at: 0 };
const TTL_MS = 30_000;

async function readToken() {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return process.env.CLAUDE_CODE_OAUTH_TOKEN;
  try {
    const raw = await readFile(CREDS_PATH, 'utf8');
    const j = JSON.parse(raw);
    return j?.claudeAiOauth?.accessToken || null;
  } catch {
    return null;
  }
}

async function readCache() {
  for (const p of CACHE_CANDIDATES) {
    try {
      const raw = await readFile(p, 'utf8');
      const j = JSON.parse(raw);
      if (j && j.five_hour) return { data: j, source: 'cache', path: p };
    } catch {
      /* пробуем следующий */
    }
  }
  return null;
}

async function fetchLive(token) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(USAGE_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-code/2.1.34',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (j && j.five_hour) return j;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Возвращает { data, source } где source: 'live' | 'cache' | null.
 */
export async function getLimits() {
  const now = Date.now();
  if (memo.data && now - memo.at < TTL_MS) return memo.data;

  const token = await readToken();
  let result = null;
  if (token) {
    const live = await fetchLive(token);
    if (live) result = { data: live, source: 'live' };
  }
  if (!result) {
    const cached = await readCache();
    if (cached) result = { data: cached.data, source: 'cache' };
  }
  if (!result) result = { data: null, source: null, error: 'no token and no cache' };

  memo = { data: result, at: now };
  return result;
}
