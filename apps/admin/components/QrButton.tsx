'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

type QrType = 'attraction' | 'restaurant' | 'shop' | 'poi' | 'menu-item' | 'shop-item';

/**
 * A per-entity QR code.
 *
 * For a location (attraction/restaurant/shop/poi) this encodes a
 * `kynren://spot/<type>/<id>` deep link that the mobile app's scanner
 * resolves to that spot on the map.
 *
 * For an individual menu item or shop product — which isn't its own map
 * spot, just something sold at one — it encodes
 * `kynren://item/<menu|shop>/<parentSlug>/<id>` instead; the scanner jumps
 * straight to that restaurant/shop's own screen rather than the map.
 * `parentSlug` is required for these two types.
 *
 * Either way: a modal with the code and a PNG download for printing/signage.
 */
export function QrButton({
  type, id, label, parentSlug,
}: {
  type: QrType;
  id: string;
  label: string;
  parentSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const value =
    type === 'menu-item' ? `kynren://item/menu/${parentSlug}/${id}`
    : type === 'shop-item' ? `kynren://item/shop/${parentSlug}/${id}`
    : `kynren://spot/${type}/${id}`;

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
