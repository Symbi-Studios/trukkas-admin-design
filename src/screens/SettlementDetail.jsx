'use client';
import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

// Settlements are no longer a page: a settlement is how one job payment was split, shown in the
// escrow drawer. Old links forward there. Escrow tranches are "mob_<escrowId>" / "fin_<escrowId>";
// adjustments and bank payouts are "txn_<transactionId>" and open the transaction instead.
export function settlementTarget(id) {
  const value = String(id || '');
  if (/^(mob|fin)_/.test(value)) return '/wallets?id=' + encodeURIComponent(value.slice(4));
  if (value.startsWith('txn_')) return '/transactions?id=' + encodeURIComponent(value.slice(4));
  return '/wallets';
}

export function SettlementDetail() {
  const router = useRouter(), search = useSearchParams(), params = useParams();
  useEffect(() => { router.replace(settlementTarget(search.get('id') || params?.settlementId)); }, [router, search, params]);
  return null;
}

/** /settlements itself forwards to Escrow, where releases now live. */
export function SettlementsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/wallets?type=Releases'); }, [router]);
  return null;
}
