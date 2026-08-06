'use client';

import { useEffect, useState } from 'react';

type Resolver = (ok: boolean) => void;
let openFn: ((message: string, title: string, resolve: Resolver) => void) | null = null;

/** Show a delete-confirmation popup; resolves true if the user confirms. */
export function confirmDelete(message = 'This action cannot be undone.', title = 'Delete?'): Promise<boolean> {
  return new Promise((resolve) => {
    if (openFn) openFn(message, title, resolve);
    else resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false);
  });
}

/** Mount once (in the dashboard layout) to render the styled confirmation modal. */
export function ConfirmHost() {
  const [state, setState] = useState<{ message: string; title: string; resolve: Resolver } | null>(null);
  useEffect(() => {
    openFn = (message, title, resolve) => setState({ message, title, resolve });
    return () => { openFn = null; };
  }, []);
  if (!state) return null;
  const done = (ok: boolean) => { state.resolve(ok); setState(null); };
  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && done(false)}>
      <div className="modal" style={{ width: 380 }}>
        <h2 style={{ marginBottom: 8 }}>{state.title}</h2>
        <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{state.message}</p>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={() => done(false)}>Cancel</button>
          <button className="primary" style={{ background: 'var(--danger)' }} onClick={() => done(true)}>Delete</button>
        </div>
      </div>
    </div>
  );
}
