'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';

interface Kpis {
  sessionsToday: number; delayed: number; cancelled: number; ticketsScanned: number;
  bookings: number; ordersToday: number; openOrders: number;
  bookingsRevenueCents: number; foodRevenueCents: number; totalRevenueCents: number; announcementsSent: number;
}
interface Analytics {
  kpis: Kpis;
  sessionStatus: Record<string, number>;
  popularAttractions: { name: string; category: string; favorites: number; seen: number }[];
}
interface Session {
  id: string; startTime: string; endTime: string; status: string; revisedStart: string | null;
  attraction: { id: string; name: string; category: string };
}

const OPENING_DAY = '2026-07-18';
const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const pounds = (c: number) => `£${(c / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const CATEGORY_COLOR: Record<string, string> = {
  BIRDS: '#3a86c8', HORSE: '#8f5a2b', LAKE: '#22b365', VIKINGS: '#e5544b', MAZE: '#8b6ff0', EVENING_SHOW: '#f5601e', OTHER: '#8a94a6',
};
const DONUT_COLORS = ['#f5601e', '#22b365', '#3a86c8', '#8b6ff0', '#e2a53b', '#e5544b'];

const TABS = ['All', 'On time', 'Delayed', 'Full', 'Finished'] as const;
type Tab = (typeof TABS)[number];
const TAB_STATUS: Record<Tab, string | null> = { All: null, 'On time': 'SCHEDULED', Delayed: 'DELAYED', Full: 'FULL', Finished: 'FINISHED' };

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [restaurantCount, setRestaurantCount] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('All');

  useEffect(() => {
    api<Analytics>(`/admin/analytics?date=${OPENING_DAY}`).then(setAnalytics).catch(() => undefined);
    api<Session[]>(`/schedule?date=${OPENING_DAY}`).then(setSessions).catch(() => undefined);
    api<unknown[]>('/restaurants').then((r) => setRestaurantCount(r.length)).catch(() => undefined);
  }, []);

  const k = analytics?.kpis;
  const attractionCount = useMemo(() => new Set(sessions.map((s) => s.attraction.id)).size, [sessions]);

  // Participation: sessions running per hour across the day.
  const series = useMemo(() => {
    const buckets = new Map<number, number>();
    for (let h = 10; h <= 22; h++) buckets.set(h, 0);
    for (const s of sessions) {
      const h = new Date(s.startTime).getUTCHours();
      if (buckets.has(h)) buckets.set(h, (buckets.get(h) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([h, n]) => ({ h, n }));
  }, [sessions]);

  // Engagement donut by category.
  const donut = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of analytics?.popularAttractions ?? []) {
      m.set(a.category, (m.get(a.category) ?? 0) + a.favorites + a.seen);
    }
    let entries = [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) entries = Object.entries(analytics?.sessionStatus ?? {}).filter(([, v]) => v > 0);
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    return entries.map(([label, value], i) => ({ label: label.replace('_', ' '), value, pct: Math.round((value / total) * 100), color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  }, [analytics]);

  const filtered = sessions.filter((s) => (TAB_STATUS[tab] ? s.status === TAB_STATUS[tab] : true));

  return (
    <div>
      {/* Stat cards */}
      <div className="stat-row">
        <StatCard cls="green" cap="Shows Today" big={k?.sessionsToday ?? '—'}
          ico="M4 19.5A2.5 2.5 0 0 1 6.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
          rows={[['On time', (k ? k.sessionsToday - k.delayed - k.cancelled : 0)], ['Delayed', k?.delayed ?? 0]]} />
        <StatCard cls="blue" cap="Attractions" big={attractionCount || '—'}
          ico="M9 18V5l12-2v13|M9 9l12-2|M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
          rows={[['Restaurants', restaurantCount ?? 0], ['Live now', sessions.filter((s) => s.status === 'SCHEDULED').length]]} />
        <StatCard cls="purple" cap="Bookings" big={k?.bookings ?? '—'}
          ico="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2|M9 2h6v4H9z"
          rows={[['Scanned', k?.ticketsScanned ?? 0], ['Announcements', k?.announcementsSent ?? 0]]} />
        <StatCard cls="orange" cap="Revenue" big={k ? pounds(k.totalRevenueCents) : '—'}
          ico="M12 1v22|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
          rows={[['Tickets', k ? pounds(k.bookingsRevenueCents) : '—'], ['Food', k ? pounds(k.foodRevenueCents) : '—']]} />
      </div>

      {/* Shows table + participation */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Today’s Shows</div>
          </div>
          <div className="tabs">
            {TABS.map((t) => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          {filtered.length === 0 && <div className="empty-chart" style={{ padding: '18px 0' }}>No shows in this view.</div>}
          {filtered.slice(0, 7).map((s) => (
            <div className="rowitem" key={s.id}>
              <div className="thumb" style={{ background: CATEGORY_COLOR[s.attraction.category] ?? '#8a94a6' }}>
                {s.attraction.name.charAt(0)}
              </div>
              <div>
                <div className="rtitle">{s.attraction.name}</div>
                <div className="rsub">{s.attraction.category.toLowerCase().replace('_', ' ')}</div>
              </div>
              <div className="rcell">{fmt(s.revisedStart ?? s.startTime)}</div>
              <div className="rcell">{Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000)}m</div>
              <span className={`pill-status ${s.status}`}>{s.status[0] + s.status.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Guest Participation</div>
            <div className="panel-pick">Show: <b>Today</b></div>
          </div>
          <AreaChart series={series} />
        </div>
      </div>

      {/* Recent + donut */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Most Engaged Attractions</div>
          </div>
          {(analytics?.popularAttractions ?? []).length === 0 && <div className="empty-chart" style={{ padding: '18px 0' }}>No engagement yet.</div>}
          {(analytics?.popularAttractions ?? []).slice(0, 4).map((a) => (
            <div className="recent-row" key={a.name}>
              <div className="thumb" style={{ background: CATEGORY_COLOR[a.category] ?? '#8a94a6' }}>{a.name.charAt(0)}</div>
              <div>
                <div className="rname">{a.name}</div>
                <div className="rmeta">{a.category.toLowerCase().replace('_', ' ')}</div>
              </div>
              <div className="rmeta">♥ {a.favorites}</div>
              <div className="rmeta">👁 {a.seen}</div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Engagement Split</div>
            <div className="panel-pick">Show: <b>This day</b></div>
          </div>
          <div className="donut-wrap" style={{ marginTop: 10 }}>
            <Donut data={donut} />
            <div className="donut-legend">
              {donut.length === 0 && <div className="empty-chart">No data yet.</div>}
              {donut.map((d) => (
                <div className="k" key={d.label}>
                  <span className="sw" style={{ background: d.color }} />
                  <span style={{ textTransform: 'capitalize' }}>{d.label.toLowerCase()}</span>
                  <span className="pct">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ cls, cap, big, ico, rows }: { cls: string; cap: string; big: number | string; ico: string; rows: [string, number | string][] }) {
  return (
    <div className={`stat ${cls}`}>
      <div className="ico">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          {ico.split('|').map((p, i) => <path key={i} d={p} />)}
        </svg>
      </div>
      <div className="cap">{cap}</div>
      <div className="big">{big}</div>
      <div className="foot">
        {rows.map(([l, v]) => (
          <div className="frow" key={l}><span>{l}</span><b>{v}</b></div>
        ))}
      </div>
    </div>
  );
}

function AreaChart({ series }: { series: { h: number; n: number }[] }) {
  const W = 560, H = 200, PL = 32, PB = 26, PT = 12;
  const max = Math.max(4, ...series.map((s) => s.n));
  const x = (i: number) => PL + (i / (series.length - 1)) * (W - PL - 8);
  const y = (n: number) => PT + (1 - n / max) * (H - PT - PB);
  const line = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(s.n).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(series.length - 1).toFixed(1)} ${H - PB} L ${x(0).toFixed(1)} ${H - PB} Z`;
  const peak = series.reduce((m, s, i) => (s.n > series[m].n ? i : m), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="ac" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22b365" stopOpacity="0.35" />
          <stop offset="1" stopColor="#22b365" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={PL} x2={W - 8} y1={PT + g * (H - PT - PB)} y2={PT + g * (H - PT - PB)} stroke="#eef0f4" strokeDasharray="4 4" />
      ))}
      <path d={area} fill="url(#ac)" />
      <path d={line} fill="none" stroke="#22b365" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(peak)} cy={y(series[peak].n)} r={5} fill="#22b365" stroke="#fff" strokeWidth={2} />
      {series.filter((_, i) => i % 3 === 0).map((s, i) => (
        <text key={s.h} x={x(i * 3)} y={H - 6} fontSize="11" fill="#8a94a6" textAnchor="middle">{s.h}:00</text>
      ))}
    </svg>
  );
}

function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 58, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r={R} fill="none" stroke="#eef0f4" strokeWidth="20" />
      {data.map((d) => {
        const len = (d.value / total) * C;
        const seg = (
          <circle key={d.label} cx="75" cy="75" r={R} fill="none" stroke={d.color} strokeWidth="20"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 75 75)" strokeLinecap="butt" />
        );
        offset += len;
        return seg;
      })}
    </svg>
  );
}
