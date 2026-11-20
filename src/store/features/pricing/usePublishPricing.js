import { useSelector } from 'react-redux';
import { useChangeAdminPricingRecordMutation } from './pricingApi.js';

const REVIEWERS = new Set(['SUPER_ADMIN', 'FINANCE_ADMIN']);

// The backend keeps a draft → submitted → active lifecycle and never edits a live rate in place.
// The Pricing page hides that: "Edit" copies a live rate into a draft, and "Save" submits and
// activates it straight away. Each step is still its own confirmed request, so a failure part-way
// leaves a clearly labelled draft or pending rate rather than a half-changed live one.
export function usePublishPricing() {
  const role = useSelector((state) => state.auth.admin?.role);
  const [change, state] = useChangeAdminPricingRecordMutation();
  const canActivate = REVIEWERS.has(role);

  /** A draft to edit: the row itself when it's already a draft, otherwise a fresh copy of it. */
  async function draftFor(row) {
    if (row.statusCode === 'DRAFT') return row;
    return change({ row, action: 'duplicate' }).unwrap();
  }

  /** Submit and activate a draft. Admins who can't activate leave it pending for a reviewer. */
  async function publish(row) {
    let current = row;
    if (current.statusCode === 'DRAFT') current = await change({ row: current, action: 'submit' }).unwrap();
    if (current.statusCode === 'PENDING_APPROVAL' && canActivate) current = await change({ row: current, action: 'activate' }).unwrap();
    return current;
  }

  const deactivate = (row) => change({ row, action: 'deactivate' }).unwrap();
  return { draftFor, publish, deactivate, canActivate, busy: state.isLoading };
}
