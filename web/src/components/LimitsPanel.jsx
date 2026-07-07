import React from 'react';
import { pctColor, untilReset } from '../util.js';

function labelFor(l) {
  if (l.kind === 'session') return 'Текущая сессия · 5 ч';
  if (l.kind === 'weekly_all') return 'Неделя · все модели';
  if (l.kind === 'weekly_scoped') {
    const name = l.scope?.model?.display_name || l.scope?.surface || 'scoped';
    return `Неделя · ${name}`;
  }
  return l.kind || l.group || 'лимит';
}

function Bar({ label, pct, resetsAt, sub }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const color = pctColor(p);
  const reset = untilReset(resetsAt);
  return (
    <div className="limit-card">
      <div className="limit-head">
        <span className="limit-label">{label}</span>
        <span className="limit-pct" style={{ color }}>
          {p}%
        </span>
      </div>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: p + '%', backgroundColor: color, boxShadow: `0 0 14px ${color}, 0 0 4px ${color}` }}
        />
      </div>
      <div className="limit-foot">
        {sub && <span>{sub}</span>}
        {reset && <span className="limit-reset">⟳ {reset}</span>}
      </div>
    </div>
  );
}

export default function LimitsPanel({ limits, source, error }) {
  if (error || !limits) {
    return (
      <section className="panel">
        <h2>Лимиты</h2>
        <p className="muted">Нет данных о лимитах {error ? `(${error})` : ''}.</p>
      </section>
    );
  }

  const list = Array.isArray(limits.limits) ? limits.limits : [];
  const bars = list.length
    ? list
    : [
        limits.five_hour && { kind: 'session', percent: limits.five_hour.utilization, resets_at: limits.five_hour.resets_at },
        limits.seven_day && { kind: 'weekly_all', percent: limits.seven_day.utilization, resets_at: limits.seven_day.resets_at },
      ].filter(Boolean);

  const extra = limits.extra_usage;
  const spend = limits.spend;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Лимиты подписки</h2>
        <span className={'tag ' + (source === 'live' ? 'tag-live' : 'tag-cache')}>
          {source === 'live' ? 'live' : source === 'cache' ? 'из кэша' : '—'}
        </span>
      </div>
      <div className="limits-grid">
        {bars.map((l, i) => (
          <Bar key={i} label={labelFor(l)} pct={l.percent ?? l.utilization ?? 0} resetsAt={l.resets_at} />
        ))}
        {extra?.is_enabled && (
          <Bar
            label="Extra usage · месяц"
            pct={extra.utilization ?? 0}
            resetsAt={null}
            sub={extra.monthly_limit ? `лимит $${(extra.monthly_limit / 100).toFixed(2)}` : null}
          />
        )}
        {spend?.enabled && (
          <Bar label="Spend" pct={spend.percent ?? 0} resetsAt={null} />
        )}
      </div>
    </section>
  );
}
