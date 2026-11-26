'use client';

import { useEffect } from 'react';

/** A bar pinned to the bottom of the page that appears once something has changed. Also warns before leaving with unsaved edits. */
export function SaveBar({
  dirty, saving, onSave, onDiscard, saved, saveLabel = 'Save changes',
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saved?: boolean;
  saveLabel?: string;
}) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!dirty && !saved) return null;
  return (
    <div className="savebar" role="status">
      {dirty ? (
        <>
          <span className="savebar-msg"><span className="savebar-dot" /> You have unsaved changes</span>
          <button className="btn-ghost" onClick={onDiscard} disabled={saving}>Discard</button>
          <button className="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : saveLabel}</button>
        </>
      ) : (
        <span className="savebar-msg ok">✓ All changes saved</span>
      )}
    </div>
  );
}
