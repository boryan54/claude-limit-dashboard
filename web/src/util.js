// Форматирование и палитра моделей.

const LOCALES = { ru: 'ru-RU', en: 'en-US', de: 'de-DE', fr: 'fr-FR', zh: 'zh-CN' };
const SOON = { ru: 'скоро', en: 'soon', de: 'bald', fr: 'bientôt', zh: '即将' };
let LANG = 'ru';
export function setLang(l) {
  if (LOCALES[l]) LANG = l;
}
function locale() {
  return LOCALES[LANG] || 'ru-RU';
}

export function fmtTokens(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export function fmtUsd(n) {
  if (n == null) return '—';
  if (n === 0) return '$0';
  if (n < 0.01) return '<$0.01';
  return '$' + n.toFixed(2);
}

export function fmtInt(n) {
  return (n ?? 0).toLocaleString(locale());
}

// Цвет по проценту — неоновая шкала (зелёный → циан → жёлтый → красный).
export function pctColor(pct) {
  if (pct >= 90) return '#ff3b6b';
  if (pct >= 70) return '#ffd24d';
  if (pct >= 50) return '#ffb055';
  return '#33ffb0';
}

// Неоновая палитра моделей, гармонирующая с циановым акцентом.
const MODEL_COLORS = {
  'claude-opus-4-8': '#a26bff',
  'claude-opus-4-7': '#8f5cf5',
  'claude-fable-5': '#ff5cc8',
  'claude-mythos-5': '#ff7ad6',
  'claude-sonnet-5': '#22e6ff',
  'claude-sonnet-4-6': '#33ffd0',
  'claude-sonnet-4-5': '#2fd6c0',
  'claude-haiku-4-5': '#a6ff4d',
  unknown: '#6b7a90',
};
const FALLBACK = ['#ffc24d', '#ff5cc8', '#22e6ff', '#a6ff4d', '#a26bff', '#33ffd0'];

export function modelColor(model, i = 0) {
  return MODEL_COLORS[model] || FALLBACK[i % FALLBACK.length];
}

// Тень-свечение для неонового элемента.
export function neonGlow(color, spread = 24, alpha = 0.55) {
  return `0 0 ${spread}px ${hexA(color, alpha)}, 0 0 ${spread * 2}px ${hexA(color, alpha * 0.5)}`;
}

// hex -> rgba строка.
export function hexA(hex, a = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Короткое имя модели для подписей.
export function shortModel(m) {
  return m
    .replace(/^claude-/, '')
    .replace('sonnet', 'Sonnet ')
    .replace('opus', 'Opus ')
    .replace('haiku', 'Haiku ')
    .replace('fable', 'Fable ')
    .replace('mythos', 'Mythos ')
    .replace(/-/g, '.')
    .trim();
}

// Общая подготовка серий для всех видов графиков и легенды.
export function prepSeries(daily, metric) {
  const set = new Set();
  (daily || []).forEach((d) => Object.keys(d.perModel).forEach((m) => set.add(m)));
  const models = [...set].sort();
  const rows = (daily || []).map((d) => {
    let total = 0;
    const parts = models.map((m) => {
      const v = d.perModel[m]?.[metric] || 0;
      total += v;
      return { model: m, value: v };
    });
    return { date: d.date, label: d.label || (d.date || '').slice(5), total, parts };
  });
  const max = Math.max(1, ...rows.map((r) => r.total));
  return { models, rows, max };
}

// «сброс через …» из ISO-даты — локализуется через Intl.RelativeTimeFormat.
export function untilReset(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms)) return null;
  if (ms <= 0) return SOON[LANG] || SOON.ru;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'always' });
  const min = Math.round(ms / 60000);
  if (min < 60) return rtf.format(min, 'minute');
  const h = Math.round(min / 60);
  if (h < 24) return rtf.format(h, 'hour');
  return rtf.format(Math.round(h / 24), 'day');
}
