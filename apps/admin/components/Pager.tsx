'use client';

import { useEffect, useMemo, useState } from 'react';

/** Client-side pagination for a data table. Defaults to 10 rows per page. */
export function usePaged<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return { page, setPage, totalPages, pageRows, total, start, end, pageSize };
}

export function Pager({ page, setPage, totalPages, total, start, end }: {
  page: number; setPage: (n: number) => void; totalPages: number; total: number; start: number; end: number;
}) {
  if (total === 0) return null;
  return (
    <div className="pager">
      <span className="pager-info">{start}–{end} of {total}</span>
      <div className="pager-btns">
        <button className="tbtn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
        <span className="pager-page">Page {page} / {totalPages}</span>
        <button className="tbtn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next ›</button>
      </div>
    </div>
  );
}
