'use client';

import { useEffect, useState } from 'react';
import { confirmDelete } from '../../../../lib/confirm';

interface Line { t: string; level: string; msg: string }
const KEY = 'sys_agentlog';
const SEED: Line[] = [
  { t: new Date().toISOString(), level: 'INFO', msg: 'Admin console started' },
  { t: new Date(Date.now() - 3.2e6).toISOString(), level: 'INFO', msg: 'Nightly backup completed (34.2 MB)' },
  { t: new Date(Date.now() - 6.4e6).toISOString(), level: 'WARN', msg: 'Realtime gateway reconnected after 2s drop' },
  { t: new Date(Date.now() - 8.1e6).toISOString(), level: 'INFO', msg: 'Schedule status changed: Land of the Vikings → FULL' },
];
const COLOR: Record<string, string> = { INFO: 'var(--muted)', WARN: 'var(--warn)', ERROR: 'var(--danger)' };

export default function AgentLog() {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) setLines(JSON.parse(raw));
    else { setLines(SEED); localStorage.setItem(KEY, JSON.stringify(SEED)); }
  }, []);
  async function clear() { if (await confirmDelete('Clear the agent log?', 'Clear log?')) { setLines([]); localStorage.setItem(KEY, '[]'); } }

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <p className="subtitle" style={{ margin: 0 }}>System and automation activity.</p>
        <button className="tbtn" onClick={clear}>Clear log</button>
      </div>
      <div className="panel" style={{ background: '#0f1320', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, lineHeight: 1.9 }}>
        {lines.length === 0 && <div style={{ color: '#7d8aa5' }}>— log empty —</div>}
        {lines.map((l, i) => (
          <div key={i} style={{ color: '#c7d0e0' }}>
            <span style={{ color: '#5f6b85' }}>{new Date(l.t).toLocaleString('en-GB')}</span>{' '}
            <b style={{ color: COLOR[l.level] ?? '#c7d0e0' }}>{l.level}</b>{' '}{l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
