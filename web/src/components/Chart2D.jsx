import React, { useEffect, useRef, useState } from 'react';
import { modelColor, shortModel, fmtTokens, fmtUsd } from '../util.js';

const H = 320;
const PAD_L = 66;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

export default function Chart2D({ rows, models, max, metric, mode }) {
  const ref = useRef(null);
  const [w, setW] = useState(760);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 760));
    ro.observe(el);
    setW(el.clientWidth || 760);
    return () => ro.disconnect();
  }, []);

  const fmt = metric === 'cost' ? fmtUsd : fmtTokens;
  const N = rows.length;
  const plotW = Math.max(10, w - PAD_L - PAD_R);
  const plotH = H - PAD_T - PAD_B;
  const x0 = PAD_L;
  const y0 = PAD_T + plotH;
  const band = plotW / Math.max(1, N);
  const yFor = (v) => y0 - (v / max) * plotH;
  const xCenter = (i) => x0 + band * i + band / 2;
  const barW = Math.min(40, band * 0.72);
  const xStep = Math.max(1, Math.ceil(N / (mode === 'line' ? 8 : 12)));

  function showBar(e, part, r) {
    const rect = ref.current.getBoundingClientRect();
    setTip({
      left: e.clientX - rect.left,
      top: e.clientY - rect.top,
      title: shortModel(part.model),
      date: r.date,
      lines: [`${fmt(part.value)}  ·  день ${fmt(r.total)}`],
    });
  }
  function showDay(e, r) {
    const rect = ref.current.getBoundingClientRect();
    const parts = r.parts
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((p) => `${shortModel(p.model)}: ${fmt(p.value)}`);
    setTip({ left: e.clientX - rect.left, top: e.clientY - rect.top, title: `Итог ${fmt(r.total)}`, date: r.date, lines: parts });
  }

  return (
    <div className="chart2d" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={w} height={H} role="img">
        <defs>
          <filter id="glow2d" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Сетка + подписи оси значений */}
        {TICKS.map((t) => {
          const y = yFor(t * max);
          return (
            <g key={t}>
              <line x1={x0} y1={y} x2={x0 + plotW} y2={y} stroke="rgba(34,230,255,0.14)" strokeWidth="1" />
              <text x={x0 - 10} y={y + 3} textAnchor="end" className="svg-axis">
                {fmt(t * max)}
              </text>
            </g>
          );
        })}

        {/* Подписи дат */}
        {rows.map((r, i) =>
          i % xStep === 0 || i === N - 1 ? (
            <text key={r.date} x={xCenter(i)} y={y0 + 20} textAnchor="middle" className="svg-date">
              {r.date.slice(5)}
            </text>
          ) : null
        )}

        {/* Столбцы */}
        {mode === 'bars' && (
          <g filter="url(#glow2d)">
            {rows.map((r, i) => {
              let cur = y0;
              return r.parts
                .filter((p) => p.value > 0)
                .map((p) => {
                  const h = (p.value / max) * plotH;
                  const y = cur - h;
                  cur = y;
                  const x = x0 + band * i + (band - barW) / 2;
                  return (
                    <rect
                      key={r.date + p.model}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(0.5, h)}
                      rx={Math.min(3, barW / 3)}
                      fill={modelColor(p.model, models.indexOf(p.model))}
                      opacity="0.92"
                      onMouseMove={(e) => showBar(e, p, r)}
                    />
                  );
                });
            })}
          </g>
        )}

        {/* Линии по моделям (не стек) */}
        {mode === 'line' && (
          <g filter="url(#glow2d)" fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            {models.map((m, mi) => {
              const d = rows
                .map((r, i) => {
                  const v = r.parts.find((p) => p.model === m)?.value || 0;
                  return `${i === 0 ? 'M' : 'L'} ${xCenter(i).toFixed(1)} ${yFor(v).toFixed(1)}`;
                })
                .join(' ');
              return <path key={m} d={d} stroke={modelColor(m, mi)} opacity="0.95" />;
            })}
            {N <= 45 &&
              models.map((m, mi) =>
                rows.map((r, i) => {
                  const v = r.parts.find((p) => p.model === m)?.value || 0;
                  if (v <= 0) return null;
                  return <circle key={m + i} cx={xCenter(i)} cy={yFor(v)} r="2.4" fill={modelColor(m, mi)} />;
                })
              )}
          </g>
        )}

        {/* Прозрачные зоны для тултипа по дню (режим линий) */}
        {mode === 'line' &&
          rows.map((r, i) => (
            <rect
              key={'hb' + i}
              x={x0 + band * i}
              y={PAD_T}
              width={band}
              height={plotH}
              fill="transparent"
              onMouseMove={(e) => showDay(e, r)}
            />
          ))}
      </svg>

      {tip && (
        <div className="chart-tip" style={{ left: tip.left, top: tip.top }}>
          <b>{tip.title}</b> · {tip.date}
          {tip.lines.map((l, i) => (
            <div key={i} className="tip-line">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
