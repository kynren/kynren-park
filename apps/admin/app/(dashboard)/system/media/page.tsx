'use client';

import { SimpleCrud } from '../../../../components/SimpleCrud';

export default function MediaCenter() {
  return (
    <SimpleCrud
      storageKey="sys_media"
      addLabel="Add media"
      emptyText="No media yet. Add image or video URLs used across the app."
      fields={[
        { key: 'title', label: 'Title' },
        { key: 'type', label: 'Type', type: 'select', options: ['Image', 'Video', 'Document'] },
        { key: 'url', label: 'URL', type: 'url', placeholder: 'https://…' },
      ]}
      columns={[{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }, { key: 'url', label: 'URL' }]}
      renderCell={(r, k) => (k === 'url'
        ? <a href={String(r.url)} target="_blank" rel="noreferrer">{String(r.url).slice(0, 40)}…</a>
        : String(r[k] ?? '—') || '—')}
    />
  );
}
