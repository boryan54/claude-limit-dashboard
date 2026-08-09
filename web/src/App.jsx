import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLimits, fetchUsage } from './api.js';
import { fmtTokens, fmtUsd, fmtInt } from './util.js';
import LimitsPanel from './components/LimitsPanel.jsx';
import RangePicker from './components/RangePicker.jsx';
import DailyChart from './components/DailyChart.jsx';
import StatTable from './components/StatTable.jsx';
import { useI18n, LanguageSelect } from './i18n.jsx';

const AUTO_SECONDS = 600; // автообновление статистики каждые 10 минут

export default function App() {
  const { t } = useI18n();
  const [limits, setLimits] = useState(null);
  const [range, setRange] = useState({ preset: 'today', from: todayYmd(), to: todayYmd() });
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
    // Один день (например «Сегодня») — почасовая разбивка.
    const granularity = r.from && r.to && r.from === r.to ? 'hour' : 'day';
    try {
      setUsage(await fetchUsage({ from: r.from, to: r.to, granularity }));
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
            <b>Claude Code</b> · {t('app.suffix')}
          </h1>
          <p className="sub">
            {t('app.subtitle')} · {usage ? t('app.files', { n: fmtInt(usage.files) }) : '…'}
          </p>
        </div>
        <div className="header-actions">
          <span className="status-chip">
            <span className="dot" />
            {source === 'live' ? t('status.live') : source === 'cache' ? t('status.cache') : t('status.offline')}
          </span>
          <span className="status-chip timer" title={t('timer.title')}>
            <span className="timer-ico">⟳</span>
            {mmss(secondsLeft)}
          </span>
          <button className="refresh-btn" onClick={doRefresh} disabled={loading} title={t('btn.refreshTitle')}>
            {loading ? '…' : '⟳'} {t('btn.refresh')}
          </button>
          <LanguageSelect />
        </div>
      </header>

      <LimitsPanel
        limits={limits?.data}
        source={limits?.source}
        error={limits?.error}
      />

      <section className="panel">
        <div className="panel-head">
          <h2>{t('section.usage')}</h2>
          <span className="muted small">{t('usage.costNote')}</span>
        </div>
        <RangePicker
          preset={range.preset}
          from={range.from}
          to={range.to}
          loading={loading}
          onChange={(r) => setRange(r)}
          onRefresh={doRefresh}
        />
        {err && (
          <p className="error">
            {t('error')}: {err}
          </p>
        )}
        {totals && (
          <div className="totals">
            <Stat label={t('stat.totalTokens')} value={fmtTokens(totals.tokens)} />
            <Stat label={t('stat.messages')} value={fmtInt(totals.messages)} />
            <Stat label={t('stat.input')} value={fmtTokens(totals.input)} />
            <Stat label={t('stat.output')} value={fmtTokens(totals.output)} />
            <Stat label={t('stat.cacheRead')} value={fmtTokens(totals.cacheRead)} />
            <Stat label={t('stat.cost')} value={fmtUsd(totals.cost)} accent />
          </div>
        )}
      </section>

      <DailyChart daily={usage?.daily || []} />
      <StatTable title={t('title.byModel')} rows={modelRows} keyLabel={t('th.model')} isModel />
      <StatTable title={t('title.byProject')} rows={projectRows} keyLabel={t('th.project')} />

      <footer className="foot">
        {t('footer.pre')}
        <code>~/.claude/projects</code>
        {t('footer.post')}
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
