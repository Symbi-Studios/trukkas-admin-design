// What the backend sends for GET /admin/overview and GET /admin/bids/analytics (only what the Operations Overview reads),
// and what the screen receives after the adapter (lib/overview/adapt.ts).

export interface BackendOverview {
  jobs?: { completedToday?: number | null; cancelledThisWeek?: number | null; delayedAtRisk?: number | null } | null;
  topRoutesByVolume?: { route?: string | null; trips?: number | null }[] | null;
  /** jobs created per day, last 7 days */
  weeklyJobVolume?: { date?: string | null; count?: number | null }[] | null;
  deliveryPerformance?: { onTime?: number | null; minorDelay?: number | null; critical?: number | null } | null;
}

interface BackendBidAnalyticsBody {
  funnel?: {
    jobsPublished?: number | null;
    jobsWithBids?: number | null;
    bidsReceived?: number | null;
    bidsAccepted?: number | null;
    jobsCompleted?: number | null;
  } | null;
  averageWinningMargin?: { amount?: number | null; percent?: number | null; sampleSize?: number | null } | null;
}

/** the body is flat today; one version of the app wrapped it as { analytics: {...} } */
export interface BackendBidAnalytics extends BackendBidAnalyticsBody {
  analytics?: BackendBidAnalyticsBody | null;
}

// ---------- what the screen gets ----------

export interface OverviewData {
  completedToday: number | null;
  cancelledThisWeek: number | null;
  delayedAtRisk: number | null;
  /** "Mon", "Tue" ... in Lagos time */
  weeklyVolume: { label: string; count: number }[];
  delivery: { onTime: number | null; minorDelay: number | null; critical: number | null };
  topRoutes: { route: string; trips: number }[];
}

export interface BidInsights {
  funnel: {
    jobsPublished: number | null;
    jobsWithBids: number | null;
    bidsReceived: number | null;
    bidsAccepted: number | null;
    jobsCompleted: number | null;
  };
  /** null while there is no accepted bid to measure */
  margin: { amount: number | null; percent: number | null };
}
