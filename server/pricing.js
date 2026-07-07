// Таблица цен $/1M токенов (input / output). Источник — справочник claude-api, актуально 2026-07.
// Кэш-токены оцениваются относительно input-ставки: запись ~1.25x, чтение ~0.1x.

const CACHE_WRITE_MULT = 1.25;
const CACHE_READ_MULT = 0.1;

// Ключи — нормализованные имена моделей. Дата-суффиксы отсекаются в normalizeModel().
const PRICES = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-opus-4-5': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-sonnet-4-5': { in: 3, out: 15 },
  'claude-fable-5': { in: 10, out: 50 },
  'claude-mythos-5': { in: 10, out: 50 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

// Короткие алиасы и синтетика — в бакет "unknown" с нулевой ценой, чтобы не искажать $.
const UNKNOWN = 'unknown';
const ALIAS_TO_UNKNOWN = new Set(['sonnet', 'haiku', 'opus', 'fable', 'mythos', '<synthetic>']);

/**
 * Приводит сырое имя модели к каноническому ключу прайса.
 * Отсекает дата-суффикс вида -20251001.
 */
export function normalizeModel(raw) {
  if (!raw || ALIAS_TO_UNKNOWN.has(raw)) return UNKNOWN;
  // Отсекаем завершающий -YYYYMMDD (8 цифр)
  const stripped = raw.replace(/-\d{8}$/, '');
  if (PRICES[stripped]) return stripped;
  if (PRICES[raw]) return raw;
  return UNKNOWN;
}

export function getRate(model) {
  return PRICES[model] || { in: 0, out: 0 };
}

/**
 * Оценка эквивалентной стоимости по API для одного набора токенов.
 * @param {string} model нормализованное имя
 * @param {{input:number,output:number,cacheWrite:number,cacheRead:number}} t
 * @returns {number} доллары
 */
export function estimateCost(model, t) {
  const rate = getRate(model);
  if (!rate.in && !rate.out) return 0;
  const dollars =
    (t.input * rate.in +
      t.cacheWrite * rate.in * CACHE_WRITE_MULT +
      t.cacheRead * rate.in * CACHE_READ_MULT +
      t.output * rate.out) /
    1e6;
  return dollars;
}

export { UNKNOWN };
