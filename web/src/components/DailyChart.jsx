import React, { useMemo, useState } from 'react';
import Chart3D from './Chart3D.jsx';
import Chart2D from './Chart2D.jsx';
import { prepSeries, modelColor, shortModel } from '../util.js';

const VIEWS = [
  { key: '3d', label: '3D' },
  { key: 'bars', label: 'Столбцы' },
  { key: 'line', label: 'Линии' },
];

export default function DailyChart({ daily }) {
  const [metric, setMetric] = useState('tokens');
  const [view, setView] = useState('3d');

  const { models, rows, max } = useMemo(() => prepSeries(daily || [], metric), [daily, metric]);
  const hasData = rows.length > 0;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>По дням</h2>
        <div className="chart-controls">
          <div className="seg-toggle">
            {VIEWS.map((v) => (
              <button key={v.key} className={view === v.key ? 'active' : ''} onClick={() => setView(v.key)}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="seg-toggle">
            <button className={metric === 'tokens' ? 'active' : ''} onClick={() => setMetric('tokens')}>
              Токены
            </button>
            <button className={metric === 'cost' ? 'active' : ''} onClick={() => setMetric('cost')}>
              $
            </button>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="chart-empty-box">нет данных за период</div>
      ) : view === '3d' ? (
        <Chart3D rows={rows} models={models} max={max} metric={metric} />
      ) : (
        <Chart2D rows={rows} models={models} max={max} metric={metric} mode={view} />
      )}

      {hasData && (
        <div className="legend">
          {models.map((m, i) => (
            <span className="legend-item" key={m}>
              <span className="swatch" style={{ background: modelColor(m, i), boxShadow: `0 0 8px ${modelColor(m, i)}` }} />
              {shortModel(m)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
