'use client';

import { useEffect, useState } from 'react';
import { API_URL, api, getToken, getStaff, setSession, type Staff } from '../../../lib/api';

export default function SettingsPage() {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [accMsg, setAccMsg] = useState('');
  const [accErr, setAccErr] = useState('');

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    const s = getStaff();
    setStaff(s); setName(s?.name ?? ''); setEmail(s?.email ?? '');
    // Pull the freshest values (email/role may have changed elsewhere).
    api<{ id: string; name: string; email: string; role: string }>('/auth/staff/me')
      .then((me) => { setStaff((p) => ({ ...(p as Staff), ...me })); setName(me.name); setEmail(me.email); })
      .catch(() => undefined);
  }, []);

  async function saveAccount() {
    setAccMsg(''); setAccErr('');
    if (!name.trim() || !email.trim()) { setAccErr('Name and email are required.'); return; }
    try {
      const me = await api<Staff>('/auth/staff/me', { method: 'PATCH', body: JSON.stringify({ name, email }) });
      const token = getToken();
      if (token) setSession(token, { id: me.id, name: me.name, email: me.email, role: me.role });
      setStaff(me); setAccMsg('Saved.'); setTimeout(() => setAccMsg(''), 2000);
    } catch (e) { setAccErr((e as Error).message || 'Save failed.'); }
  }

  async function changePassword() {
    setPwMsg(''); setPwErr('');
    if (newPw.length < 8) { setPwErr('New password must be at least 8 characters.'); return; }
    try {
      await api('/auth/staff/me/password', { method: 'POST', body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }) });
      setCurPw(''); setNewPw(''); setPwMsg('Password changed.'); setTimeout(() => setPwMsg(''), 2000);
    } catch (e) { setPwErr((e as Error).message || 'Change failed.'); }
  }

  return (
    <div>
      <h1>Settings</h1>
      <p className="subtitle">Your staff account and workspace configuration.</p>

      <div className="set-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}>Account</div>
          <div className="form-row" style={{ marginBottom: 10 }}><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="form-row" style={{ marginBottom: 10 }}><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="form-row" style={{ marginBottom: 12 }}><label>Role</label><input readOnly value={staff?.role ?? ''} /></div>
          {accErr && <div className="error">{accErr}</div>}
          <button className="primary" onClick={saveAccount}>Save account</button>
          {accMsg && <span style={{ marginLeft: 10, color: 'var(--green)', fontSize: 13 }}>{accMsg}</span>}
        </div>

        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}>Change password</div>
          <div className="form-row" style={{ marginBottom: 10 }}><label>Current password</label><input type={showPw ? 'text' : 'password'} value={curPw} onChange={(e) => setCurPw(e.target.value)} /></div>
          <div className="form-row" style={{ marginBottom: 8 }}><label>New password</label><input type={showPw ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min 8 characters" /></div>
          <label className="checkline" style={{ marginBottom: 12 }}><input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} /> Show passwords</label>
          {pwErr && <div className="error">{pwErr}</div>}
          <button className="primary" onClick={changePassword}>Update password</button>
          {pwMsg && <span style={{ marginLeft: 10, color: 'var(--green)', fontSize: 13 }}>{pwMsg}</span>}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-title" style={{ marginBottom: 12 }}>Workspace</div>
        <div className="form-row" style={{ marginBottom: 10 }}><label>API endpoint</label><input readOnly value={API_URL} /></div>
        <p className="hint">Manage staff accounts and role permissions under <b>System → Staff</b> and <b>System → Roles & Permissions</b>.</p>
      </div>
    </div>
  );
}
