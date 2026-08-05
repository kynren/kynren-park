'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

interface Analytics {
  date: string;
  kpis: {
    sessionsToday: number;
    delayed: number;
    cancelled: number;
    ticketsScanned: number;
    bookings: number;
    ordersToday: number;
    openOrders: number;
    bookingsRevenueCents: number;
    foodRevenueCents: number;
    totalRevenueCents: number;
    announcementsSent: number;
  };
  sessionStatus: Record<string, number>;
  orderStatus: Record<string, number>;
  popularAttractions: { name: string; category: string; favorites: number; seen: number }[];
  ticketTypeBreakdown: { name: string; count: number }[];
}

const OPENING_DAY = '2026-07-18';
const pounds = (c: number) => `£${(c / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

// Validated categorical pair (dataviz validator: all checks pass, CVD ΔE 17.3).
const C_FAV = '#d1495b';
const C_SEEN = '#3a86c8';

// Reserved status palette (never reused as categorical series).
const SESSION_STATUS: [string, string, string][] = [
  ['SCHEDULED', 'On time', 'var(--ok)'],
  ['DELAYED', 'Delayed', 'var(--warn)'],
  ['FULL', 'Full', 'var(--full)'],
  ['CANCELLED', 'Cancelled', 'var(--danger)'],
  ['FINISHED', 'Finished', 'var(--muted)'],
];
const ORDER_STATUS: [string, string, string][] = [
  ['PENDING', 'Pending', 'var(--muted)'],
  ['PREPARING', 'Preparing', 'var(--warn)'],
  ['READY', 'Ready', 'var(--ok)'],
  ['COLLECTED', 'Collected', '#3a86c8'],
  ['CANCELLED', 'Cancelled', 'var(--danger)'],
];

export default function AnalyticsPage() {
  const [date, setDate] = useState(OPENING_DAY);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api<Analytics>(`/admin/analytics?date=${date}`)
      .then(setData)
      .catch(() => setError('Could not load analytics.'));
  }, [date]);

  const k = data?.kpis;
  const tiles = [
    { l: 'Total revenue', n: k ? pounds(k.totalRevenueCents) : '—' },
    { l: 'Ticket revenue', n: k ? pounds(k.bookingsRevenueCents) : '—' },
    { l: 'Food revenue', n: k ? pounds(k.foodRevenueCents) : '—' },
    { l: 'Tickets scanned', n: k?.ticketsScanned ?? '—' },
    { l: 'Sessions today', n: k?.sessionsToday ?? '—' },
    { l: 'Open food orders', n: k?.openOrders ?? '—' },
    { l: 'Bookings', n: k?.bookings ?? '—' },
    { l: 'Announcements sent', n: k?.announcementsSent ?? '—' },
  ];

  const maxEngagement = Math.max(1, ...(data?.popularAttractions ?? []).map((a) => a.favorites + a.seen));

  return (
    <div>
      <h1>Analytics</h1>
      <p className="subtitle">Operational and engagement snapshot for the selected day.</p>
      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {error && <div className="chart-card">{error}</div>}

      {/* KPI tiles */}
      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.l} className="tile">
            <div className="n">{t.n}</div>
            <div className="l">{t.l}</div>
          </div>
        ))}
      </div>

      {/* Popular attractions — stacked horizontal bars */}
      <div className="chart-card">
        <p className="chart-title">Most engaging attractions</p>
        <p className="chart-sub">By guest favourites and “seen” marks.</p>
        <div className="legend">
          <span className="key"><span className="swatch" style={{ background: C_FAV }} /> Favourites</span>
          <span className="key"><span className="swatch" style={{ background: C_SEEN }} /> Seen</span>
        </div>
        {(data?.popularAttractions ?? []).length === 0 && <div className="empty-chart">No engagement data yet.</div>}
        {(data?.popularAttractions ?? []).map((a) => {
          const total = a.favorites + a.seen;
          const w = (total / maxEngagement) * 100;
          return (
            <div className="hbar-row" key={a.name}>
              <div className="hbar-label" title={a.name}>{a.name}</div>
              <div className="hbar-track">
                <div style={{ width: `${w}%`, display: 'flex', gap: 2, height: '100%' }}>
                  {a.favorites > 0 && (
                    <div className="hbar-seg" style={{ background: C_FAV, flex: a.favorites }} title={`${a.favorites} favourites`} />
                  )}
                  {a.seen > 0 && (
                    <div className="hbar-seg" style={{ background: C_SEEN, flex: a.seen }} title={`${a.seen} seen`} />
                  )}
                </div>
              </div>
              <div className="hbar-val">{total}</div>
            </div>
          );
        })}
      </div>

      {/* Session status breakdown */}
      <StatusChart title="Today’s sessions by status" data={data?.sessionStatus} palette={SESSION_STATUS} />
      {/* Order status breakdown */}
      <StatusChart title="Click & Collect orders by status" data={data?.orderStatus} palette={ORDER_STATUS} />

      {/* Ticket type breakdown */}
      <div className="chart-card">
        <p className="chart-title">Tickets by type</p>
        <p className="chart-sub">Tickets on bookings for {date}.</p>
        {(data?.ticketTypeBreakdown ?? []).length === 0 && <div className="empty-chart">No tickets booked for this date.</div>}
        {(() => {
          const max = Math.max(1, ...(data?.ticketTypeBreakdown ?? []).map((t) => t.count));
          return (data?.ticketTypeBreakdown ?? []).map((t) => (
            <div className="hbar-row" key={t.name}>
              <div className="hbar-label" title={t.name}>{t.name}</div>
              <div className="hbar-track">
                <div className="hbar-seg" style={{ background: 'var(--brand)', width: `${(t.count / max) * 100}%` }} />
              </div>
              <div className="hbar-val">{t.count}</div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}

function StatusChart({
  title,
  data,
  palette,
}: {
  title: string;
  data?: Record<string, number>;
  palette: [string, string, string][];
}) {
  const entries = palette.map(([key, label, color]) => ({ key, label, color, count: data?.[key] ?? 0 }));
  const total = entries.reduce((a, b) => a + b.count, 0);
  return (
    <div className="chart-card">
      <p className="chart-title">{title}</p>
      {total === 0 ? (
        <div className="empty-chart">No data for this day.</div>
      ) : (
        <>
          <div className="status-bar">
            {entries
              .filter((e) => e.count > 0)
              .map((e) => (
                <div key={e.key} className="status-seg" style={{ background: e.color, flex: e.count }} title={`${e.label}: ${e.count}`} />
              ))}
          </div>
          <div className="status-legend">
            {entries.map((e) => (
              <span key={e.key} className="k">
                <span className="dot" style={{ background: e.color }} /> {e.label} <b>{e.count}</b>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
