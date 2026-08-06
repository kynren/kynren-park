'use client';

import { useEffect, useState } from 'react';

type Req =
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; danger: boolean; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; title: string; message: string; def: string; resolve: (v: string | null) => void };

let openFn: ((req: Req) => void) | null = null;

interface ConfirmOpts { confirmLabel?: string; danger?: boolean }

/** Confirmation popup; resolves true if the user confirms. Defaults to a
 *  red “Delete” action — pass `confirmLabel`/`danger` for other actions. */
export function confirmDelete(message = 'This action cannot be undone.', title = 'Delete?', opts: ConfirmOpts = {}): Promise<boolean> {
  const confirmLabel = opts.confirmLabel ?? 'Delete';
  const danger = opts.danger ?? true;
  return new Promise((resolve) => {
    if (openFn) openFn({ kind: 'confirm', title, message, confirmLabel, danger, resolve });
    else resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false);
  });
}

/** Non-destructive confirmation (neutral button, custom label). */
export function confirmAction(message: string, title: string, confirmLabel = 'Confirm'): Promise<boolean> {
  return confirmDelete(message, title, { confirmLabel, danger: false });
}

/** In-app replacement for window.prompt() (which Next/the sandbox block). */
export function promptText(message: string, def = '', title = ''): Promise<string | null> {
  return new Promise((resolve) => {
    if (openFn) openFn({ kind: 'prompt', title: title || message, message: title ? message : '', def, resolve });
    else resolve(null);
  });
}

/** Mount once (in the dashboard layout) to render confirm + prompt dialogs. */
export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  const [value, setValue] = useState('');
  useEffect(() => {
    openFn = (r) => { setReq(r); if (r.kind === 'prompt') setValue(r.def); };
    return () => { openFn = null; };
  }, []);
  if (!req) return null;

  const shell = (children: React.ReactNode, onBackdrop: () => void) => (
    <div className="modal-back" style={{ background: 'transparent' }} onClick={(e) => e.target === e.currentTarget && onBackdrop()}>
      <div className="modal" style={{ width: 400, boxShadow: '0 12px 40px rgba(20,25,40,0.28)' }}>{children}</div>
    </div>
  );

  if (req.kind === 'confirm') {
    const done = (ok: boolean) => { req.resolve(ok); setReq(null); };
    return shell(
      <>
        <h2 style={{ marginBottom: 8 }}>{req.title}</h2>
        <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{req.message}</p>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={() => done(false)}>Cancel</button>
          <button className="primary" style={req.danger ? { background: 'var(--danger)' } : undefined} onClick={() => done(true)}>{req.confirmLabel}</button>
        </div>
      </>,
      () => done(false),
    );
  }

  const done = (v: string | null) => { req.resolve(v); setReq(null); };
  return shell(
    <>
      <h2 style={{ marginBottom: 8 }}>{req.title}</h2>
      {req.message ? <p style={{ color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>{req.message}</p> : null}
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') done(value); if (e.key === 'Escape') done(null); }}
        style={{ width: '100%' }}
      />
      <div className="modal-foot">
        <button className="btn-ghost" onClick={() => done(null)}>Cancel</button>
        <button className="primary" onClick={() => done(value)}>OK</button>
      </div>
    </>,
    () => done(null),
  );
}
