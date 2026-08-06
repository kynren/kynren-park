'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';

interface DbStats { generatedAt: string; tables: { name: string; rows: number }[] }

export default function Database() {
  const [data, setData] = useState<DbStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { api<DbStats>('/admin/db-stats').then(setData).catch(() => setError('Could not load database stats.')); }, []);

  const total = data?.tables.reduce((s, t) => s + t.rows, 0) ?? 0;

  return (
    <div>
      <div className="page-actions" style={{ marginTop: 0 }}>
        <div className="dot-status up"><span className="d" /> PostgreSQL connected</div>
        <div className="panel-pick">Total rows: <b>{total.toLocaleString()}</b></div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="kv">
        {(data?.tables ?? []).map((t) => (
          <div className="cell" key={t.name}><div className="n">{t.rows.toLocaleString()}</div><div className="l">{t.name}</div></div>
        ))}
      </div>
      {data && <p className="hint">Snapshot generated {new Date(data.generatedAt).toLocaleString('en-GB')}.</p>}
    </div>
  );
}
