'use client';
import { FinanceRedirect } from './FinanceRedirect.jsx';

/** Escrow holds open in a drawer on /wallets; this route forwards old detail links there. */
export function EscrowHoldDetail() {
  return <FinanceRedirect path="/wallets" paramKey="holdId" />;
}
