'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, API_URL } from '../../../lib/api';
import { REALTIME_EVENTS, type SessionUpdatedEvent } from '@kynren/shared';

interface Session {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  revisedStart: string | null;
  note: string | null;
  attraction: { id: string; name: string; category: string };
}

const OPENING_DAY = '2026-07-18';
const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

export default function SchedulePage() {
  const [date, setDate] = useState(OPENING_DAY);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async (d: string) => {
    const data = await api<Session[]>(`/schedule?date=${d}`);
    setSessions(data);
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  // Live updates: reflect changes made by any staff member instantly.
  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { date });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(REALTIME_EVENTS.sessionUpdated, (e: SessionUpdatedEvent) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === e.id ? { ...s, status: e.status, revisedStart: e.revisedStart, note: e.note } : s,
        ),
      );
    });
    return () => {
      socket.disconnect();
    };
  }, [date]);

  async function setStatus(session: Session, status: string) {
    let revisedStart: string | undefined;
    let note: string | undefined;
    if (status === 'DELAYED') {
      const mins = prompt(`Delay "${session.attraction.name}" by how many minutes?`, '15');
      if (mins === null) return;
      revisedStart = new Date(new Date(session.startTime).getTime() + parseInt(mins, 10) * 60000).toISOString();
      note = `Delayed by ${mins} minutes.`;
    }
    if (status === 'CANCELLED') {
      note = prompt('Reason for cancellation (optional):') || undefined;
      if (!confirm(`Cancel "${session.attraction.name}" at ${fmt(session.startTime)}?`)) return;
    }
    // Optimistic update; the socket echo will confirm.
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, status } : s)));
    await api(`/schedule/${session.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, revisedStart, note }),
    }).catch(() => load(date));
  }

  return (
    <div>
      <h1>Live Schedule Board</h1>
      <p className="subtitle">
        Change a show’s status and every visitor’s app updates instantly — with a push notification
        to guests who have it in their plan.
      </p>

      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="act" onClick={() => load(date)}>Refresh</button>
        <span className="live">
          <span className="dot" style={{ background: connected ? 'var(--ok)' : 'var(--muted)' }} />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      <div className="board">
        {sessions.length === 0 && <div className="card">No sessions scheduled for this date.</div>}
        {sessions.map((s) => (
          <div key={s.id} className={`session ${s.status}`}>
            <div>
              <div className="time">{fmt(s.revisedStart ?? s.startTime)}</div>
              {s.revisedStart && <div className="cat" style={{ textDecoration: 'line-through' }}>{fmt(s.startTime)}</div>}
            </div>
            <div>
              <div className="name">{s.attraction.name}</div>
              <div className="cat">{s.attraction.category.toLowerCase().replace('_', ' ')}</div>
              {s.note && <div className="hint">{s.note}</div>}
            </div>
            <div className="actions">
              <span className={`badge ${s.status}`}>{s.status}</span>
              <button className="act" onClick={() => setStatus(s, 'SCHEDULED')}>On time</button>
              <button className="act" onClick={() => setStatus(s, 'DELAYED')}>Delay</button>
              <button className="act" onClick={() => setStatus(s, 'FULL')}>Full</button>
              <button className="act" onClick={() => setStatus(s, 'CANCELLED')}>Cancel</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
