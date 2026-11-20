'use client';
import { FinanceRedirect } from './FinanceRedirect.jsx';

/** Transactions open in a drawer on /transactions; this route forwards old detail links there. */
export function TransactionDetail() {
  return <FinanceRedirect path="/transactions" paramKey="transactionId" />;
}
