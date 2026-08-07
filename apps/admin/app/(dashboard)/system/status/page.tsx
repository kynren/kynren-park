'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, friendlyError } from '../../../../lib/api';

type Health = 'up' | 'down' | 'degraded';
interface DayCell { date: string; status: Health | 'none' }
interface Component {
  key: string; name: string; status: Health; detail: string;
  latencyMs: number | null; checkedAt: string | null; uptimePct: number | null; days: DayCell[];
}
interface StatusReport {
  overall: Health; intervalMinutes: number; lastCheckedAt: string | null; components: Component[];
}

const INTERVALS = [
  { v: 15, label: '15 minutes' }, { v: 30, label: '30 minutes' }, { v: 60, label: '1 hour' },
  { v: 360, label: '6 hours' }, { v: 720, label: '12 hours' }, { v: 1440, label: '24 hours' },
];
const COLOR: Record<string, string> = { up: '#22a35a', degraded: '#e2a53b', down: '#e5544b', none: '#e6e3dd' };
const BADGE: Record<Health, { label: string; bg: string; fg: string }> = {
  up: { label: 'OPERATIONAL', bg: '#e7f8ee', fg: '#1c8a4e' },
  degraded: { label: 'DEGRADED', bg: '#fbf1dd', fg: '#a9761a' },
  down: { label: 'DOWN', bg: '#fdeceb', fg: '#c23b32' },
};
const BANNER: Record<Health, { text: string; bg: string }> = {
  up: { text: 'All Systems Operational', bg: '#1f9d57' },
  degraded: { text: 'Partial Service Disruption', bg: '#d99423' },
  down: { text: 'Major Service Outage', bg: '#d4483d' },
};

export default function SystemStatus() {
  const [report, setReport] = useState<StatusReport | null>(null);
  const [interval, setIntervalVal] = useState(60);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  const apply = useCallback((r: StatusReport) => { setReport(r); setIntervalVal(r.intervalMinutes); }, []);

  const load = useCallback(() => {
    api<StatusReport>('/admin/status')
      .then(apply)
      .catch((e) => setError(friendlyError(e, 'Could not load status.')));
  }, [apply]);
  useEffect(load, [load]);

  async function checkNow() {
    setChecking(true); setError('');
    try { apply(await api<StatusReport>('/admin/status/check', { method: 'POST' })); }
    catch (e) { setError(friendlyError(e, 'Check failed.')); }
    finally { setChecking(false); }
  }
  async function saveInterval() {
    setSaving(true); setError('');
    try {
      apply(await api<StatusReport>('/admin/status/settings', { method: 'PATCH', body: JSON.stringify({ intervalMinutes: interval }) }));
      setSavedTick(true); setTimeout(() => setSavedTick(false), 1800);
    } catch (e) { setError(friendlyError(e, 'Save failed.')); }
    finally { setSaving(false); }
  }

  const overall = report?.overall ?? 'up';
  const banner = BANNER[overall];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overall banner */}
      <div style={{ background: banner.bg, color: '#fff', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <b style={{ fontSize: 18 }}>{banner.text}</b>
        <button className="tbtn" onClick={checkNow} disabled={checking}
          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', fontWeight: 700 }}>
          {checking ? 'Checking…' : '↻ Check Now'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Check interval */}
      <div style={{ background: 'var(--card)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <b>Check interval</b>
          <div className="hint" style={{ marginTop: 2 }}>How often each component is automatically re-checked. Default: 1 hour.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={interval} onChange={(e) => setIntervalVal(Number(e.target.value))} style={{ padding: '9px 12px' }}>
            {INTERVALS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <button className="primary" onClick={saveInterval} disabled={saving || interval === report?.intervalMinutes}>
            {saving ? 'Saving…' : savedTick ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      <p className="hint" style={{ textAlign: 'right', margin: 0 }}>
        Uptime over the past 90 days. Bars with no colour mean no health check has run for that day yet.
      </p>

      {/* Components */}
      <div style={{ background: 'var(--card)', borderRadius: 14, overflow: 'hidden' }}>
        {(report?.components ?? []).map((c, i) => {
          const badge = BADGE[c.status];
          return (
            <div key={c.key} style={{ padding: '20px 22px', borderTop: i ? '1px solid var(--line)' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <b style={{ fontSize: 16 }}>{c.name}</b>
                <span className="pillbadge" style={{ background: badge.bg, color: badge.fg, fontWeight: 800, letterSpacing: 0.4 }}>{badge.label}</span>
              </div>
              {/* 90-day uptime bars */}
              <div style={{ display: 'flex', gap: 2, height: 34, marginTop: 12, alignItems: 'stretch' }}>
                {c.days.map((d) => (
                  <div key={d.date} title={`${d.date} · ${d.status === 'none' ? 'no data' : d.status}`}
                    style={{ flex: 1, background: COLOR[d.status], borderRadius: 2, minWidth: 2 }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span className="hint">90 days ago</span>
                <span className="hint">{c.uptimePct != null ? `${c.uptimePct}% uptime` : 'no data yet'}</span>
                <span className="hint">Today</span>
              </div>
              <div className="hint" style={{ marginTop: 8 }}>
                {c.detail}
                {c.latencyMs != null && c.latencyMs > 0 ? ` · ${c.latencyMs}ms` : ''}
              </div>
            </div>
          );
        })}
        {!report && <div style={{ padding: 22, color: 'var(--muted)' }}>Loading status…</div>}
      </div>

      {report?.lastCheckedAt && (
        <p className="hint" style={{ margin: 0 }}>Last checked {new Date(report.lastCheckedAt).toLocaleString('en-GB')}.</p>
      )}
    </div>
  );
}
