'use client';

import { useEffect, useState } from 'react';

export type ToastKind = 'info' | 'progress' | 'success' | 'error';
export interface Toast { id: number; message: string; kind: ToastKind; progress?: number }

let seq = 1;
let emit: ((toasts: Toast[]) => void) | null = null;
let toasts: Toast[] = [];
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function flush() { emit?.([...toasts]); }
function scheduleDismiss(id: number, ms: number) {
  const prev = timers.get(id); if (prev) clearTimeout(prev);
  timers.set(id, setTimeout(() => { dismissToast(id); }, ms));
}

/** Show a toast; auto-dismisses except while a progress toast is running. */
export function showToast(message: string, kind: ToastKind = 'info', progress?: number): number {
  const id = seq++;
  toasts = [...toasts, { id, message, kind, progress }];
  flush();
  if (kind !== 'progress') scheduleDismiss(id, kind === 'error' ? 6000 : 3200);
  return id;
}
export function updateToast(id: number, patch: Partial<Omit<Toast, 'id'>>) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, ...patch } : t));
  flush();
  if (patch.kind && patch.kind !== 'progress') scheduleDismiss(id, patch.kind === 'error' ? 6000 : 2800);
}
export function dismissToast(id: number) {
  const tm = timers.get(id); if (tm) { clearTimeout(tm); timers.delete(id); }
  toasts = toasts.filter((t) => t.id !== id);
  flush();
}

export function toastSuccess(message: string) { return showToast(message, 'success'); }
export function toastError(message: string) { return showToast(message, 'error'); }

/**
 * A progress toast for an upload. Drive it from the upload lifecycle:
 * `const t = uploadToast('Uploading…'); t.progress(45); t.success('Done');`
 */
export function uploadToast(label: string) {
  const id = showToast(label, 'progress', 0);
  return {
    id,
    progress: (pct: number) => updateToast(id, { kind: 'progress', progress: Math.max(0, Math.min(100, Math.round(pct))) }),
    label: (message: string) => updateToast(id, { message }),
    success: (message: string) => updateToast(id, { kind: 'success', message, progress: 100 }),
    error: (message: string) => updateToast(id, { kind: 'error', message }),
    dismiss: () => dismissToast(id),
  };
}

function ToastCard({ t }: { t: Toast }) {
  const icon = t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : t.kind === 'progress' ? '↑' : 'i';
  const accent = t.kind === 'success' ? 'var(--green, #22b365)' : t.kind === 'error' ? 'var(--danger, #e5544b)' : 'var(--brand, #8f1d21)';
  return (
    <div className="toast-card" role="status" aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="toast-ico" style={{ background: accent }}>{icon}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, lineHeight: 1.35 }}>
          {t.message}{t.kind === 'progress' && t.progress != null ? ` — ${t.progress}%` : ''}
        </span>
        <button className="toast-x" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>✕</button>
      </div>
      {t.kind === 'progress' && (
        <div className="toast-bar"><div className="toast-bar-fill" style={{ width: `${t.progress ?? 0}%` }} /></div>
      )}
    </div>
  );
}

/** Mount once (in the dashboard layout) to render toasts bottom-right. */
export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => { emit = setItems; return () => { emit = null; }; }, []);
  if (items.length === 0) return null;
  return (
    <div className="toast-wrap">
      {items.map((t) => <ToastCard key={t.id} t={t} />)}
    </div>
  );
}
