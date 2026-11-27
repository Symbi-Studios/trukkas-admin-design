"use client";

import { Skeleton } from "../ds.js";
import styles from "./JobsTrips.module.css";

const SKELETON_CELL_WIDTHS = ["68%", "84%", "54%", "78%", "60%", "72%", "56%", "66%", "62%", "48%"];

/** Grey rows where the table will be: shown on first load and while a filter, a search or a page change is loading */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className={styles.loadingTable} aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div className={styles.loadingRow} key={rowIndex}>
          {SKELETON_CELL_WIDTHS.map((width, columnIndex) => <Skeleton key={columnIndex} width={width} height={11} />)}
        </div>
      ))}
    </div>
  );
}
