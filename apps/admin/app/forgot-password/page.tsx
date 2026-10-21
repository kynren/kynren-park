'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/auth/staff/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'Too many requests — wait a minute and try again.' : 'Could not send the email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo" style={{ fontSize: 30 }}>Kyn<b>ren</b></div>
        <p className="subtitle" style={{ textAlign: 'center' }}>Reset your password</p>
        {sent ? (
          <>
            <p style={{ lineHeight: 1.5 }}>
              If <b>{email.trim()}</b> is a staff account, we’ve emailed it a link to choose a new password. The link works once and expires in 1 hour.
            </p>
            <p className="subtitle">Nothing arrived? Check your spam folder, or ask an administrator.</p>
          </>
        ) : (
          <>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" autoFocus required />
            {error && <div className="error">{error}</div>}
            <button className="primary" style={{ width: '100%', marginTop: 18 }} disabled={loading || !email.trim()}>
              {loading ? 'Sending…' : 'Email me a reset link'}
            </button>
          </>
        )}
        <p style={{ textAlign: 'center', marginTop: 16 }}><Link href="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}
