'use client';
import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '../domain/urlState.js';

// Finance records open in a side drawer on their list page. The old /…/detail routes
// stay so existing links keep working: they forward to the list with ?id= (and any extra params).
export function FinanceRedirect({ path, paramKey, keep = [] }) {
  const router = useRouter(), search = useSearchParams(), params = useParams();
  useEffect(() => {
    const id = search.get('id') || params?.[paramKey] || '';
    router.replace(withParams(path, { id, ...Object.fromEntries(keep.map((key) => [key, search.get(key)])) }));
  }, [router, search, params, path, paramKey, keep]);
  return null;
}
