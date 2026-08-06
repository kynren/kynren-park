'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession, ApiError, API_URL, type Staff } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@kynren.com');
  const [password, setPassword] = useState('kynren-admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api<{ accessToken: string; staff: Staff }>('/auth/staff/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession(res.accessToken, res.staff);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setError(`Can’t reach the API (${API_URL}). Is \`npm run dev:api\` running?`);
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(err instanceof Error ? err.message : 'Sign in failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo" style={{ fontSize: 30 }}>Kyn<b>ren</b></div>
        <p className="subtitle" style={{ textAlign: 'center' }}>The Storied Lands — Operations</p>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        <label>Password</label>
        <div style={{ position: 'relative' }}>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} style={{ width: '100%', paddingRight: 58 }} />
          <button type="button" onClick={() => setShowPw((v) => !v)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="primary" style={{ width: '100%', marginTop: 18 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="hint">Seed login: admin@kynren.com / kynren-admin</p>
      </form>
    </div>
  );
}
