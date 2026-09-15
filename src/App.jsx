"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation.js";
import {
  AppShell,
  Sidebar,
  SidebarNavItem,
  SidebarSectionLabel,
  TopBar,
} from "./ds.js";
import { NAV, SEARCH_PLACEHOLDER } from "./nav.js";
import { useCollection } from "./mock/useCollection.js";
import "./mock/api.js";

export function AdminShell({ children }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [globalSearch, setGlobalSearch] = React.useState("");
  const notificationRows = useCollection("notifications") || [];
  const router = useRouter();
  const pathname = usePathname();
  const activeId = pathname.split("/")[1] || "dashboard";
  React.useEffect(() => {
    setGlobalSearch("");
    setMobileNavOpen(false);
  }, [pathname]);

  function toggleNavigation() {
    if (window.matchMedia("(max-width: 1023px)").matches) setMobileNavOpen((open) => !open);
    else setCollapsed((current) => !current);
  }

  const sidebar = (
    <Sidebar
      collapsed={collapsed}
      onCollapse={toggleNavigation}
      footer={
        !collapsed && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--tk-r-lg)",
              border: "1px solid var(--tk-line)",
              background: "var(--tk-surface-sunk)",
            }}
          >
            <span
              style={{
                display: "block",
                font: "600 13px/18px var(--tk-font-sans)",
                color: "var(--tk-ink-900)",
              }}
            >
              Trukkas is moving Africa forward.
            </span>
            <span
              style={{
                display: "block",
                marginTop: 2,
                font: "400 12px/16px var(--tk-font-sans)",
                color: "var(--tk-ink-400)",
              }}
            >
              Safer. Smarter. Together.
            </span>
          </div>
        )
      }
    >
      {NAV.map((group) => (
        <React.Fragment key={group.section}>
          {!collapsed && (
            <SidebarSectionLabel>{group.section}</SidebarSectionLabel>
          )}
          {group.items.map((item, index) => (
            <SidebarNavItem
              key={item.id + index}
              collapsed={collapsed}
              icon={item.icon}
              label={item.label}
              active={item.id === activeId}
              onClick={() => router.push("/" + item.id)}
            />
          ))}
        </React.Fragment>
      ))}
    </Sidebar>
  );

  return (
    <AppShell
      sidebar={sidebar}
      mobileNavOpen={mobileNavOpen}
      onMobileNavClose={() => setMobileNavOpen(false)}
      topbar={
        <TopBar
          onMenu={toggleNavigation}
          notifications={notificationRows.filter((row) => !row.read).length}
          searchPlaceholder={SEARCH_PLACEHOLDER[activeId]}
          searchValue={globalSearch}
          onSearch={(event) => {
            setGlobalSearch(event.target.value);
            window.dispatchEvent(
              new CustomEvent("trukkas:global-search", {
                detail: event.target.value,
              }),
            );
          }}
          onNotifications={() => router.push("/notifications")}
          user="Trukkas Admin"
          role="Super Admin"
        />
      }
    >
      {children}
    </AppShell>
  );
}
