'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession, type Staff } from '../../lib/api';

export default function AcceptInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<{ email: string; role: string } | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    setToken(t);
    if (!t) { setLoadErr('This link is missing its invitation token.'); return; }
    api<{ email: string; role: string }>(`/auth/staff/invite/${t}`)
      .then(setInfo)
      .catch((e) => setLoadErr((e as Error).message || 'This invitation is invalid or has expired.'));
  }, []);

  async function accept() {
    setErr('');
    if (!name.trim()) { setErr('Please enter your name.'); return; }
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setBusy(true);
    try {
      const r = await api<{ accessToken: string; staff: Staff }>('/auth/staff/accept-invite', {
        method: 'POST', body: JSON.stringify({ token, name, password }),
      });
      setSession(r.accessToken, r.staff);
      router.replace('/dashboard');
    } catch (e) { setErr((e as Error).message || 'Could not accept the invitation.'); setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg, #f6f7f9)', padding: 20 }}>
      <div className="modal" style={{ width: 420, boxShadow: '0 12px 40px rgba(20,25,40,0.18)' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#8f1d21', marginBottom: 4 }}>Kynren</div>
        <h2 style={{ marginTop: 0 }}>Accept your invitation</h2>

        {loadErr ? (
          <div className="error">{loadErr}</div>
        ) : !info ? (
          <p className="subtitle">Checking your invitation…</p>
        ) : (
          <>
            <p className="subtitle" style={{ marginTop: 0 }}>
              You’re joining as <b>{info.role}</b> — <b>{info.email}</b>. Set your name and a password to finish.
            </p>
            <div className="form-row" style={{ marginBottom: 10 }}><label>Your name</label><input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="form-row" style={{ marginBottom: 8 }}><label>Password</label><input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" /></div>
            <label className="checkline" style={{ marginBottom: 14 }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password</label>
            {err && <div className="error">{err}</div>}
            <button className="primary" style={{ width: '100%' }} onClick={accept} disabled={busy}>{busy ? 'Setting up…' : 'Accept & sign in'}</button>
          </>
        )}
      </div>
    </div>
  );
}
