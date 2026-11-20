'use client';
import { FinanceRedirect } from './FinanceRedirect.jsx';

/** Demurrage charges open in a drawer on /demurrage; this route forwards old detail links there. */
export function DemurrageDetail() {
  return <FinanceRedirect path="/demurrage" paramKey="demurrageId" />;
}
