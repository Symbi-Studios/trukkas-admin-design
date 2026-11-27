"use client";

import { DropdownMenu, FilterSelect } from "../ds.js";
import styles from "./JobsTrips.module.css";

// One filter chip with its menu. Jobs and Trips use it; the URL holds the chosen value.

interface FilterControlProps {
  name: string;
  icon: string;
  value: string;
  allValue: string;
  options: string[];
  menu: string | null;
  setMenu: (next: string | null) => void;
  onChange: (label: string) => void;
}

export function FilterControl({ name, icon, value, allValue, options, menu, setMenu, onChange }: FilterControlProps) {
  return (
    <span className={styles.filterWrap}>
      <FilterSelect
        icon={icon}
        prefix={name}
        label={value}
        active={value !== allValue}
        onClick={() => setMenu(menu === name ? null : name)}
        onClear={() => { onChange(allValue); setMenu(null); }}
      />
      {menu === name && (
        <span className={styles.menuPopover}>
          <DropdownMenu
            width={216}
            items={options.map((option) => ({
              label: option,
              icon: option === value ? "check" : undefined,
              onClick: () => { onChange(option); setMenu(null); },
            }))}
          />
        </span>
      )}
    </span>
  );
}
