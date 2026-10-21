'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setLoading(true);
    try {
      await api('/auth/staff/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      router.replace('/login?reset=1');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'Too many attempts — wait a minute and try again.' : err instanceof Error ? err.message : 'Could not reset the password.');
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo" style={{ fontSize: 30 }}>Kyn<b>ren</b></div>
        <p className="subtitle" style={{ textAlign: 'center' }}>Choose a new password</p>
        {token === '' ? (
          <div className="error">This link is missing its reset token. <Link href="/forgot-password">Request a new one</Link>.</div>
        ) : (
          <>
            <label>New password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus placeholder="min 8 characters" />
            <label>Confirm password</label>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type={show ? 'text' : 'password'} autoComplete="new-password" />
            <label className="checkline" style={{ margin: '10px 0' }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
            {error && (
              <div className="error">{error} {/invalid or has expired/.test(error) && <Link href="/forgot-password">Request a new link</Link>}</div>
            )}
            <button className="primary" style={{ width: '100%', marginTop: 12 }} disabled={loading || token === null}>
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </>
        )}
        <p style={{ textAlign: 'center', marginTop: 16 }}><Link href="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}
