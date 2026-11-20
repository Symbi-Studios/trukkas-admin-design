'use client';
import { FinanceRedirect } from './FinanceRedirect.jsx';

const KEEP = ['source'];
/** Payouts open in a drawer on /payouts; this route forwards old detail links there. */
export function PayoutDetail() {
  return <FinanceRedirect path="/payouts" paramKey="payoutId" keep={KEEP} />;
}
