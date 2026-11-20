'use client';
import { FinanceRedirect } from './FinanceRedirect.jsx';

/** Rate cards open in a drawer on /pricing; this route forwards old detail links there. */
export function PricingDetail() {
  return <FinanceRedirect path="/pricing" paramKey="priceId" />;
}
