'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../../../../lib/api';

interface Svc { name: string; up: boolean; detail: string }

export default function SystemStatus() {
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const check = useCallback(async () => {
    const out: Svc[] = [];
    // API health
    try {
      const t0 = performance.now();
      const res = await fetch(`${API_URL}/api/health`);
      const ms = Math.round(performance.now() - t0);
      out.push({ name: 'API', up: res.ok, detail: res.ok ? `Healthy · ${ms}ms` : `HTTP ${res.status}` });
    } catch { out.push({ name: 'API', up: false, detail: 'Unreachable' }); }
    // Sync bundle (database-backed)
    try {
      const res = await fetch(`${API_URL}/api/sync/bundle?date=2026-07-18`);
      out.push({ name: 'Database / Sync', up: res.ok, detail: res.ok ? 'Serving content' : `HTTP ${res.status}` });
    } catch { out.push({ name: 'Database / Sync', up: false, detail: 'Unreachable' }); }
    // Realtime gateway (socket.io handshake endpoint)
    try {
      const res = await fetch(`${API_URL}/socket.io/?EIO=4&transport=polling`);
      out.push({ name: 'Realtime (WebSocket)', up: res.ok, detail: res.ok ? 'Gateway online' : `HTTP ${res.status}` });
    } catch { out.push({ name: 'Realtime (WebSocket)', up: false, detail: 'Unreachable' }); }
    setSvcs(out);
    setCheckedAt(new Date());
  }, []);

  useEffect(() => { check(); }, [check]);

  const allUp = svcs.length > 0 && svcs.every((s) => s.up);

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <div className={`dot-status ${allUp ? 'up' : 'down'}`}><span className="d" /> {allUp ? 'All systems operational' : 'Degraded / checking…'}</div>
        <button className="tbtn" onClick={check}>Re-check</button>
      </div>
      <div className="board">
        {svcs.map((s) => (
          <div className="rowline" style={{ background: 'var(--card)', borderRadius: 14, padding: '16px 18px', border: 0 }} key={s.name}>
            <div><b>{s.name}</b><div className="hint" style={{ marginTop: 2 }}>{s.detail}</div></div>
            <div className={`dot-status ${s.up ? 'up' : 'down'}`}><span className="d" /> {s.up ? 'Operational' : 'Down'}</div>
          </div>
        ))}
      </div>
      {checkedAt && <p className="hint">Last checked {checkedAt.toLocaleTimeString('en-GB')} · endpoint {API_URL}</p>}
    </div>
  );
}
