import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";

/**
 * Ranked list: rank, name (+ muted detail), a thin bar scaled to the leader, the value and an
 * optional secondary figure. Rows with `onClick` are buttons.
 *  - rows = [{ id, label, detail?, value:number|null, display, secondary?, onClick? }]
 *  - empty: node shown when rows is empty; loading: shows placeholder rows.
 */
export function Leaderboard({ rows = [], loading = false, empty, limit, style }) {
  if (loading) {
    return (
      <ol className="tk-leaderboard" style={style} aria-busy="true">
        {Array.from({ length: Math.min(limit || 5, 5) }, (_, i) => (
          <li key={i} className="tk-leaderboard-row is-loading"><span className="tk-leaderboard-rank" />
            <span className="tk-leaderboard-main"><span className="tk-leaderboard-skeleton" style={{ width: `${70 - i * 9}%` }} /></span>
            <span className="tk-leaderboard-skeleton" style={{ width: 48 }} />
          </li>
        ))}
      </ol>
    );
  }
  const shown = limit ? rows.slice(0, limit) : rows;
  if (!shown.length) return empty || null;
  const max = Math.max(0, ...shown.map((r) => (Number.isFinite(r.value) ? Math.abs(r.value) : 0)));
  return (
    <ol className="tk-leaderboard" style={style}>
      {shown.map((row, index) => {
        const content = (
          <>
            <span className="tk-leaderboard-rank">{index + 1}</span>
            <span className="tk-leaderboard-main">
              <span className="tk-leaderboard-name">
                <span title={typeof row.label === "string" ? row.label : undefined}>{row.label}</span>
                {row.detail && <span className="tk-leaderboard-detail">{row.detail}</span>}
              </span>
              <span className="tk-leaderboard-bar" aria-hidden="true">
                <span style={{ width: max > 0 && Number.isFinite(row.value) ? `${Math.max(2, (Math.abs(row.value) / max) * 100)}%` : 0 }} />
              </span>
            </span>
            <span className="tk-leaderboard-value">
              <strong>{row.display}</strong>
              {row.secondary != null && <span>{row.secondary}</span>}
            </span>
            {row.onClick && <Icon name="chevron-right" size={14} className="tk-leaderboard-chevron" aria-hidden="true" />}
          </>
        );
        return (
          <li key={row.id ?? index}>
            {row.onClick
              ? <button type="button" className="tk-leaderboard-row is-link" onClick={row.onClick}>{content}</button>
              : <div className="tk-leaderboard-row">{content}</div>}
          </li>
        );
      })}
    </ol>
  );
}
