import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLimits, fetchUsage } from './api.js';
import { fmtTokens, fmtUsd, fmtInt } from './util.js';
import LimitsPanel from './components/LimitsPanel.jsx';
import RangePicker from './components/RangePicker.jsx';
import DailyChart from './components/DailyChart.jsx';
import StatTable from './components/StatTable.jsx';

const AUTO_SECONDS = 600; // автообновление статистики каждые 10 минут

export default function App() {
  const [limits, setLimits] = useState(null);
  const [range, setRange] = useState({ preset: '30d', from: agoYmd(29), to: todayYmd() });
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_SECONDS);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const loadLimits = useCallback(async () => {
    try {
      setLimits(await fetchLimits());
    } catch (e) {
      setLimits({ data: null, source: null, error: String(e) });
    }
  }, []);

  const loadUsage = useCallback(async (r) => {
    setLoading(true);
    setErr(null);
    try {
      setUsage(await fetchUsage({ from: r.from, to: r.to }));
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Обновить всё сейчас и сбросить таймер.
  const doRefresh = useCallback(() => {
    loadUsage(rangeRef.current);
    loadLimits();
    setSecondsLeft(AUTO_SECONDS);
  }, [loadUsage, loadLimits]);

  useEffect(() => {
    loadLimits();
    const id = setInterval(loadLimits, 60_000);
    return () => clearInterval(id);
  }, [loadLimits]);

  // Смена периода — перезагрузка статистики и сброс таймера.
  useEffect(() => {
    loadUsage(range);
    setSecondsLeft(AUTO_SECONDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  // Секундный тикер обратного отсчёта.
  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // По достижении нуля — автообновление.
  useEffect(() => {
    if (secondsLeft === 0) doRefresh();
  }, [secondsLeft, doRefresh]);

  const totals = usage?.totals;
  const modelRows = (usage?.byModel || []).map((r) => ({ ...r, key: r.model }));
  const projectRows = (usage?.byProject || []).map((r) => ({ ...r, key: r.project }));

  const source = limits?.source;

  return (
    <div className="app">
      <div className="bg" />
      <div className="bg-grid" />
      <div className="bg-blob b1" />
      <div className="bg-blob b2" />
      <div className="bg-blob b3" />

      <header className="topbar">
        <div>
          <h1>
            <b>Claude Code</b> · лимиты и статистика
          </h1>
          <p className="sub">
            Локальный дашборд · {usage ? `${fmtInt(usage.files)} файлов транскриптов` : '…'}
          </p>
        </div>
        <div className="header-actions">
          <span className="status-chip">
            <span className="dot" />
            {source === 'live' ? 'API online' : source === 'cache' ? 'из кэша' : 'нет связи'}
          </span>
          <span className="status-chip timer" title="До автообновления статистики">
            <span className="timer-ico">⟳</span>
            {mmss(secondsLeft)}
          </span>
          <button className="refresh-btn" onClick={doRefresh} disabled={loading} title="Обновить сейчас">
            {loading ? '…' : '⟳'} Обновить
          </button>
        </div>
      </header>

      <LimitsPanel
        limits={limits?.data}
        source={limits?.source}
        error={limits?.error}
      />

      <section className="panel">
        <div className="panel-head">
          <h2>Статистика использования</h2>
          <span className="muted small">$ — оценка эквивалентной стоимости по API-прайсу</span>
        </div>
        <RangePicker
          preset={range.preset}
          from={range.from}
          to={range.to}
          loading={loading}
          onChange={(r) => setRange(r)}
          onRefresh={doRefresh}
        />
        {err && <p className="error">Ошибка: {err}</p>}
        {totals && (
          <div className="totals">
            <Stat label="Всего токенов" value={fmtTokens(totals.tokens)} />
            <Stat label="Сообщений" value={fmtInt(totals.messages)} />
            <Stat label="Input" value={fmtTokens(totals.input)} />
            <Stat label="Output" value={fmtTokens(totals.output)} />
            <Stat label="Cache read" value={fmtTokens(totals.cacheRead)} />
            <Stat label="Стоимость (оценка)" value={fmtUsd(totals.cost)} accent />
          </div>
        )}
      </section>

      <DailyChart daily={usage?.daily || []} />
      <StatTable title="По моделям" rows={modelRows} keyLabel="Модель" isModel />
      <StatTable title="По проектам" rows={projectRows} keyLabel="Проект" />

      <footer className="foot">
        Данные читаются из <code>~/.claude/projects</code> и эндпоинта oauth/usage. Ничего не отправляется вовне.
      </footer>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={'stat' + (accent ? ' accent' : '')}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function mmss(sec) {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}
function agoYmd(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
