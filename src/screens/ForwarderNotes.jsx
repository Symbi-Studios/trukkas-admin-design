"use client";

import { useState } from 'react';
import { Banner, Button, EmptyState, Pagination } from '../ds.js';
import { DriverTableLoading } from './DriversLoading.jsx';
import { forwarderError, useGetAdminForwarderNotesQuery } from '../store/features/forwarders/forwardersApi.js';
export function ForwarderNotes({
  id,
  owner,
  preview = false
}) {
  const [page, setPage] = useState(1);
  const query = useGetAdminForwarderNotesQuery({
    id,
    owner,
    page,
    limit: 20
  }, {
    refetchOnMountOrArgChange: true
  });
  const data = query.error ? null : query.currentData;
  if (query.isFetching) return <DriverTableLoading columns={2} label="Loading notes" />;
  if (query.error) return <Banner tone="danger" action={<Button variant="outline" onClick={query.refetch}>Retry</Button>}>{forwarderError(query.error)}</Banner>;
  if (!data?.rows.length) return <EmptyState icon="file-text" title="No notes yet" description="Internal notes added for this forwarder will appear here." />;
  return <>{data.rows.slice(0, preview ? 3 : data.rows.length).map(note => <div key={note.id} className="fd-row" style={{
      display: 'grid',
      gap: 6
    }}><p style={{
        margin: 0,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere'
      }}>{note.body}</p><span className="tk-meta">{note.admin} · {note.createdAt}</span></div>)}{!preview && <Pagination page={page} pageSize={data.pagination.limit} total={data.pagination.total} pageCount={Math.max(1, data.pagination.totalPages)} onPage={next => setPage(Math.max(1, Math.min(next, Math.max(1, data.pagination.totalPages))))} />}</>;
}
