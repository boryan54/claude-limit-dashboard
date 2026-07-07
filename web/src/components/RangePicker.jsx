import React from 'react';
import { useI18n } from '../i18n.jsx';

function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

const PRESETS = [
  { key: 'today', tkey: 'range.today', range: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { key: '7d', tkey: 'range.7d', range: () => ({ from: daysAgo(6), to: ymd(new Date()) }) },
  { key: '30d', tkey: 'range.30d', range: () => ({ from: daysAgo(29), to: ymd(new Date()) }) },
  { key: 'all', tkey: 'range.all', range: () => ({ from: '', to: '' }) },
];

export default function RangePicker({ preset, from, to, onChange, onRefresh, loading }) {
  const { t } = useI18n();
  return (
    <div className="range">
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className={'preset' + (preset === p.key ? ' active' : '')}
            onClick={() => onChange({ preset: p.key, ...p.range() })}
          >
            {t(p.tkey)}
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
          {loading ? '…' : `⟳ ${t('btn.refresh')}`}
        </button>
      </div>
    </div>
  );
}
