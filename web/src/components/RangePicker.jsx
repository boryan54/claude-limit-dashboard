import React from 'react';

function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

const PRESETS = [
  { key: 'today', label: 'Сегодня', range: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { key: '7d', label: '7 дней', range: () => ({ from: daysAgo(6), to: ymd(new Date()) }) },
  { key: '30d', label: '30 дней', range: () => ({ from: daysAgo(29), to: ymd(new Date()) }) },
  { key: 'all', label: 'Всё время', range: () => ({ from: '', to: '' }) },
];

export default function RangePicker({ preset, from, to, onChange, onRefresh, loading }) {
  return (
    <div className="range">
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className={'preset' + (preset === p.key ? ' active' : '')}
            onClick={() => onChange({ preset: p.key, ...p.range() })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="custom-range">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onChange({ preset: 'custom', from: e.target.value, to })}
        />
        <span className="dash">—</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onChange({ preset: 'custom', from, to: e.target.value })}
        />
        <button className="refresh" onClick={onRefresh} disabled={loading}>
          {loading ? '…' : '⟳ Обновить'}
        </button>
      </div>
    </div>
  );
}
