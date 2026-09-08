# Trukkas Admin prototype — handoff notes

This is a running React prototype of the Trukkas Admin console, built on top of the
design system at the repo root (`../components`, `../tokens`, `../assets`). It's real
code you can click through — routing, filtering, and several write actions actually
mutate state — but it is **not** wired to a real backend and does not cover every
screen yet. This file says exactly where the line is.

## Running it

```
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## What's real vs. what's scaffolding

**Real:**
- Routing (`react-router-dom`) — every sidebar destination has a URL (`/fleet`, `/wallets`, …),
  plus dynamic detail routes (`/jobs/:jobId`, `/triangulation/:matchId`).
- The design system is imported as real ES modules (`src/ds.js` barrel), not `window`
  globals + runtime Babel like the old `ui_kits/admin-console` preview.
- A `Modal` component (`components/feedback/Modal.jsx`) — added to the design system
  itself, not just the app, since none existed. Scrim + centered dialog, closes on
  Escape/backdrop-click/×. Powers Add Truck (Fleet), New Announcement (Announcements),
  Add/Withdraw Funds (Wallets), and Assign/Reassign Truck (Dispatch Center, Job Detail).
- A mock data layer (`src/mock/`) covering trucks, verifications, wallet/transactions,
  announcements, jobs, container-triangulation matches, drivers, truck companies, cargo
  records, and cargo types. Real write actions across every built screen: search/filter
  (Fleet, Jobs & Trips, Announcements, Container Triangulation, Drivers, Truck
  Companies, Cargo Management, Cargo Types), status changes with a live timeline
  (Verification, Job Detail, Triangulation Detail), money movement with a prepended
  transaction row (Wallets), cross-domain writes (assigning a truck in Dispatch Center
  or Job Detail updates *both* the job and the truck's own status/trip in Fleet
  Management; a driver's detail page reads its truck live from the `trucks` collection;
  a company's detail page derives its fleet by filtering `trucks`; Cargo Management
  links each record out to its real Job Detail page rather than duplicating job data).
  See "Mock data contract" below before wiring a real API.
- **Truck Calculator** does a real client-side calculation (not mock-API-backed — no
  write, so no async needed) — picks a truck type from cargo type + weight, and prices
  a route from a small fixed rate table in `TruckCalculator.jsx` itself.
- **Truck Companies** was rebuilt to transcribe `uploads/trukkas-admin/005-efbfa5ee.png`
  directly rather than reusing invented data — see "Two independent company datasets"
  below, since this matters if you touch Fleet or Drivers next to it.

**Scaffolding, not yet built:**
- **Screen coverage.** 14 nav destinations are bespoke now (Dashboard, Fleet Management,
  Verification, Wallets, Announcements, Jobs & Trips, Dispatch Center, Live Tracking,
  Container Triangulation, Drivers, Truck Companies, Cargo Management, Cargo Types,
  Truck Calculator), plus 4 detail routes (Job Detail, Triangulation Detail, Driver
  Detail, Company Detail). The other 13 nav destinations still render an honest
  `ScreenPlaceholder` ("isn't built yet") rather than a fabricated layout — see
  `src/screens/ScreenPlaceholder.jsx`.
- **No loading/error states.** The mock API resolves after a short artificial delay but
  never rejects. A real backend integration needs to handle latency, failures, empty
  results, and permission errors — none of that exists here yet.
- **No persistence across a hard reload.** The mock store lives only in memory for the
  life of the page. Client-side navigation (clicking sidebar links, `<Link>`s) keeps
  state correctly; typing a new URL or hitting refresh re-seeds everything from the
  fixtures. Confirmed while testing the Assign Truck flow — expected behavior for an
  in-memory-only store, not a bug, but worth knowing before demoing.
- **No auth, no permission gating.** Every action is available to everyone.
- **No tests.**

## Mock data contract

`src/mock/api.js` exports async, id-keyed functions shaped like real network calls —
`setTruckStatus(plate, status)`, `approveVerification(id)`, `addFunds(amount, opts)`,
`assignTruckToJob(jobId, plate)`, `approveTriangulationMatch(id)`, etc. Each currently
reads/writes an in-memory store (`src/mock/db.js`) and resolves after ~220ms. Note that
`assignTruckToJob` writes to *two* domains (`jobs` and `trucks`) in one call — a real
backend implementation likely needs the same two-table write inside one transaction.
To swap in a real backend:

1. Replace the body of each function in `api.js` with a `fetch`/API-client call that
   returns the same shape it currently returns (the patched/created row).
2. Delete `src/mock/db.js`, `useCollection.js`, and the `fixtures/` seed data — no
   screen imports them directly, only `api.js` and `App.jsx`'s seeding side effect do.
3. Add error handling at the call sites (`.catch` / try-catch around the `await`) —
   right now every call site assumes success.

Screens read live data via `useCollection(domain)` (a `useSyncExternalStore` hook) —
that hook has no opinion on where the data comes from, so it doesn't need to change.

## Visual values: confirmed vs. inferred

The design system's own `readme.md` (repo root) documents which colors/states are
confirmed by the Trukkas team versus sampled/guessed from lossy screenshots — see its
**"Confirmed by the team"** and **"Caveats — please correct these"** sections. That
document is still the source of truth; nothing in this prototype changes those facts,
it only consumes the tokens as given.

## A layout gotcha hit during this build (worth knowing before adding new screens)

Several screens use a `1fr 320px` CSS Grid to lay out a main column next to a narrow
rail of stacked cards. The natural way to write "here's a group of cards for the rail"
is `<>{cardA}{cardB}{cardC}</>` — **don't do this inside a grid container.** A React
Fragment doesn't create a DOM node, so its children become independent grid items and
get auto-placed into alternating columns instead of staying grouped in one column. It
happened here — `Requirements Checklist` on Verification landed squeezed into the
320px rail column instead of the main column — and was fixed by wrapping each column's
group in a real `<div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>`.
Any new bespoke screen using this two-column pattern needs the same real wrapper, not a
Fragment.

## Two independent company datasets — don't assume they reconcile

`fixtures/companies.js` (the 8 rows Truck Companies now shows — Global Haulage Ltd,
Atlantic Logistics, Zenith Transport, …) was transcribed from that screen's own source
screenshot. `fixtures/trucks.js` (SpeedLine Logistics, D-Line Logistics, Prime Haulage
Ltd, …) was transcribed from the *Fleet Management* screenshot, a different capture
with its own sample data. The two lists don't share a single company name. Earlier in
this build, Truck Companies computed its "fleet size" by filtering `trucks` for a
name match — that only worked by coincidence (both fixtures happened to use plausible-
sounding logistics-company names) and would show 0 trucks for every real company now.
`companies.js` carries its own static `trucks`/`drivers` counts instead. If a future
screen needs the two domains to actually cross-reference (e.g. a truck's company page
listing its real trucks), reconcile the company names in one fixture to match the
other first — don't assume a name-string match will find anything.

`companyStats` in the same fixture file (Total Companies 128, Total Trucks 1,245, …) is
static, decorative platform-wide flavor — same treatment as Dashboard's KPI row — since
this prototype only mocks 8 of the 128 companies the screenshot implies. The table's own
pagination ("Showing 1 to 8 of 8") is real and tied to the actual 8 rows, not to 128 —
a deliberate deviation from the source screenshot's "of 128" so the pagination controls
don't promise pages of data that don't exist.

## A second grid-overflow bug, and a new DataTable capability

`minmax(0, 1fr) 320px` is now the standard for the two-column layout (see the Fragment
gotcha above) — plain `1fr` doesn't shrink below its content's intrinsic minimum width,
so a sufficiently wide table pushes the whole grid wider than the viewport and clips the
rail off-screen. Truck Companies' 10-column table was the first screen wide enough to
hit this; all 11 screens using the two-column grid were hardened proactively rather than
waiting to hit it again.

For genuinely dense tables (Truck Companies has 10 columns), `DataTable` now accepts an
opt-in `tableLayout="fixed"` prop (default remains `'auto'`, so every other screen is
unaffected). Under the default auto layout, browsers size columns by content and will
starve an ellipsis-truncated column down to near-zero to satisfy a badge or icon's
harder minimum elsewhere — `fixed` makes each column's declared `width` authoritative
instead. Pair it with an `overflow:hidden; textOverflow:ellipsis` (single line) or plain
wrapping (`overflowWrap:'break-word'`, multi-word content like a company name) style on
cell content, and give text that must stay legible — names, not secondary details like
a truncated email — a real column width budget rather than squeezing it to fit everything
without any scroll. See `TruckCompanies.jsx`'s column definitions for a worked example,
including the reasoning for which cells got `ellipsis` (email, phone, reg. no. — full
value is one click away on the detail page) vs. `wrap` (company name, contact name —
the primary thing a reader scans the row for).

## Known cosmetic gaps (not fixed, low priority)

- `DonutChart`'s `centerValue` clips when given a long string (e.g. a full Naira amount
  like "₦78,430,500" on the Wallets screen) — the component was designed around short
  values like "72%" or "486".
- `RankBarList` numeric/percentage labels can clip in a 320px rail card at larger figures
  (Fleet Management → Truck Types).
- `ListRow` titles can truncate in the rail when paired with a trailing badge and a
  value column (Wallets → Bank Accounts, "Zenith Bank Plc" → "Zenith B...").

These are pre-existing component-level fit issues exposed by using realistic data widths,
not regressions from this pass. Worth a follow-up pass through `components/data/RankBarList.jsx`,
`components/data/DonutChart.jsx`, and `components/patterns/ListRow.jsx`.
