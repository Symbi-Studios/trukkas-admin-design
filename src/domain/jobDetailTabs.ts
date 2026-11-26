// The tabs on the job page. Kept out of the screen file because the screen is a client file:
// the Next.js server cannot read a value (only a component) exported from a client file.

export const JOB_DETAIL_TABS = ['overview', 'bids', 'trips', 'tracking', 'documents', 'financials', 'activity'] as const;

export type JobDetailTab = (typeof JOB_DETAIL_TABS)[number];

export function isJobDetailTab(value: string): value is JobDetailTab {
  return (JOB_DETAIL_TABS as readonly string[]).includes(value);
}