"use client";
import { Link } from "../router.js";
import { Icon, SectionCard } from "../ds.js";

// Links a finance record to its neighbours in the money flow
// (escrow hold → settlement → transaction → payout), so detail pages don't
// need to repeat each other's data. Items without a target are skipped.
export function FinanceRelatedLinks({ title = "Related Records", items }) {
  const links = items.filter((item) => item && item.to);
  if (!links.length) return null;
  return (
    <SectionCard title={title}>
      {links.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--tk-line)", color: "inherit", textDecoration: "none" }}
        >
          <span style={{ width: 34, height: 34, borderRadius: "var(--tk-r-sm)", background: "var(--tk-blue-soft)", color: "var(--tk-blue)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name={item.icon} size={16} />
          </span>
          <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
            <span style={{ font: "600 13px/18px var(--tk-font-sans)", color: "var(--tk-blue)", overflowWrap: "anywhere" }}>{item.label}</span>
            {item.description && <span className="tk-meta">{item.description}</span>}
          </span>
          <Icon name="chevron-right" size={16} color="var(--tk-ink-300)" />
        </Link>
      ))}
    </SectionCard>
  );
}
