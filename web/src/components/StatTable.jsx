import React, { useState } from 'react';
import { fmtTokens, fmtInt, fmtUsd, modelColor, shortModel } from '../util.js';
import { useI18n } from '../i18n.jsx';

// rows: [{ key, input, output, cacheWrite, cacheRead, tokens, messages, cost }]
export default function StatTable({ title, rows, keyLabel, isModel }) {
  const { t } = useI18n();
  const [sort, setSort] = useState({ col: 'tokens', dir: -1 });

  const sorted = [...rows].sort((a, b) => {
    const va = sort.col === 'key' ? a.key : a[sort.col];
    const vb = sort.col === 'key' ? b.key : b[sort.col];
    if (va < vb) return sort.dir;
    if (va > vb) return -sort.dir;
    return 0;
  });

  const th = (col, label, cls) => (
    <th
      className={(cls || '') + (sort.col === col ? ' sorted' : '')}
      onClick={() => setSort((s) => ({ col, dir: s.col === col ? -s.dir : -1 }))}
    >
      {label}
      {sort.col === col ? (sort.dir === -1 ? ' ▾' : ' ▴') : ''}
    </th>
  );

  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {th('key', keyLabel)}
              {th('messages', t('th.messages'), 'num')}
              {th('input', t('th.input'), 'num')}
              {th('output', t('th.output'), 'num')}
              {th('cacheWrite', t('th.cacheW'), 'num')}
              {th('cacheRead', t('th.cacheR'), 'num')}
              {th('tokens', t('th.total'), 'num')}
              {th('cost', t('th.costEst'), 'num')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.key}>
                <td className="key-cell">
                  {isModel && (
                    <span
                      className="swatch"
                      style={{ background: modelColor(r.key, i), boxShadow: `0 0 8px ${modelColor(r.key, i)}` }}
                    />
                  )}
                  {isModel ? shortModel(r.key) : r.key}
                </td>
                <td className="num">{fmtInt(r.messages)}</td>
                <td className="num">{fmtTokens(r.input)}</td>
                <td className="num">{fmtTokens(r.output)}</td>
                <td className="num">{fmtTokens(r.cacheWrite)}</td>
                <td className="num">{fmtTokens(r.cacheRead)}</td>
                <td className="num strong">{fmtTokens(r.tokens)}</td>
                <td className="num">{fmtUsd(r.cost)}</td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={8} className="muted">
                  {t('table.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
