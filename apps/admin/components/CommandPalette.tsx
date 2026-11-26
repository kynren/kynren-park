'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePerms } from '../lib/perms';
import { DESTINATIONS, type Dest } from '../lib/nav';

/** Ctrl/Cmd+K jump-to-page search. Only lists pages the signed-in staff member may open. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { can } = usePerms();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return DESTINATIONS
      .filter((d) => !d.perm || can(d.perm))
      .filter((d) => {
        const hay = `${d.label} ${d.group} ${d.keywords ?? ''}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
  }, [q, can]);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    list.current?.querySelector('.cmd-item.sel')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  const go = (d: Dest) => { onClose(); router.push(d.href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); go(results[sel]); }
  };

  let lastGroup = '';
  return (
    <div className="cmd-back" onMouseDown={onClose} role="presentation">
      <div className="cmd" role="dialog" aria-modal="true" aria-label="Search the console" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="cmd-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
          </svg>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a page…" aria-label="Search" />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmd-list" ref={list}>
          {results.length === 0 && <div className="cmd-empty">Nothing matches “{q}”.</div>}
          {results.map((d, i) => {
            const head = d.group !== lastGroup ? <div className="cmd-group" key={`g-${d.group}`}>{d.group}</div> : null;
            lastGroup = d.group;
            return (
              <div key={d.href}>
                {head}
                <button className={`cmd-item ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(d)}>
                  {d.label}
                  <small>{d.href}</small>
                </button>
              </div>
            );
          })}
        </div>
        <div className="cmd-foot"><span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span></div>
      </div>
    </div>
  );
}
