'use client';

import { useRef } from 'react';
import { resizeToJpeg } from '../lib/images';

/**
 * One picture slot: a preview, Upload / Replace and Remove buttons, and a hint.
 * Large photos are shrunk in the browser first. Pass `read` to handle the file differently (for example to keep a GIF animated).
 */
export function ImageField({
  value, onChange, onError, label, hint, width = 200, height = 120, maxDim = 1400, accept = 'image/*', maxMb = 15, read, empty = 'No image',
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  onError?: (message: string) => void;
  label?: string;
  hint?: string;
  width?: number;
  height?: number;
  maxDim?: number;
  accept?: string;
  maxMb?: number;
  read?: (file: File) => Promise<string>;
  empty?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) { onError?.(`That picture is over ${maxMb} MB.`); return; }
    try { onChange(await (read ? read(file) : resizeToJpeg(file, maxDim))); }
    catch { onError?.('Could not read that picture.'); }
  }

  return (
    <div className="imgfield">
      {label && <label>{label}</label>}
      <div className="imgfield-row">
        <div className="mediabox" style={{ width, height }}>
          {value ? <img src={value} alt="" /> : <span className="imgfield-empty">{empty}</span>}
        </div>
        <div className="imgfield-side">
          <input ref={ref} type="file" accept={accept} hidden onChange={pick} />
          <button type="button" className="tbtn" onClick={() => ref.current?.click()}>{value ? 'Replace' : 'Upload'}</button>
          {value ? <button type="button" className="tbtn danger" onClick={() => onChange('')}>Remove</button> : null}
          {hint && <span className="hint">{hint}</span>}
        </div>
      </div>
    </div>
  );
}
