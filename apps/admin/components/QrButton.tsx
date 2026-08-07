'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

/**
 * A per-entity QR code. Encodes a `kynren://spot/<type>/<id>` deep link that the
 * mobile app's scanner resolves to the spot on the map. Shows a modal with the
 * code and a PNG download for printing/signage.
 */
export function QrButton({ type, id, label }: { type: 'attraction' | 'restaurant' | 'poi'; id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const value = `kynren://spot/${type}/${id}`;

  function download() {
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${type}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || id}-qr.png`;
    a.click();
  }

  return (
    <>
      <button className="tbtn" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>QR</button>
      {open && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" style={{ width: 360, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 2 }}>Scan code</h2>
            <p className="subtitle">{label}</p>
            <div ref={ref} style={{ display: 'flex', justifyContent: 'center', padding: 16, background: '#fff', borderRadius: 12, marginTop: 8 }}>
              <QRCodeCanvas value={value} size={220} marginSize={2} level="M" />
            </div>
            <p className="hint" style={{ wordBreak: 'break-all', marginTop: 10 }}>{value}</p>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Close</button>
              <button className="primary" onClick={download}>Download PNG</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
