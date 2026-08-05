'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  createdAt: string;
}

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    setList(await api<Announcement[]>('/announcements'));
  }
  useEffect(() => {
    load();
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !body) return;
    setSending(true);
    try {
      await api('/announcements', { method: 'POST', body: JSON.stringify({ title, body, audience: 'ALL' }) });
      setTitle('');
      setBody('');
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Announcements</h1>
      <p className="subtitle">Publish a message to every visitor’s app — delivered live and as a push notification.</p>

      <form className="card" onSubmit={send} style={{ marginBottom: 24 }}>
        <label>Title</label>
        <input style={{ width: '100%' }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Legend of the Wear moved to 5pm" />
        <label style={{ display: 'block', marginTop: 12 }}>Message</label>
        <textarea
          style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="primary" style={{ marginTop: 14 }} disabled={sending}>
          {sending ? 'Sending…' : 'Publish to all guests'}
        </button>
      </form>

      <div className="board">
        {list.map((a) => (
          <div key={a.id} className="card">
            <strong>{a.title}</strong>
            <div className="hint">{new Date(a.createdAt).toLocaleString('en-GB')} · {a.audience}</div>
            <p style={{ margin: '8px 0 0' }}>{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
