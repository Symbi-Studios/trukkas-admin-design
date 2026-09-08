"use client";

import { PageHeader, Card, EmptyState } from "../ds.js";
import { SettingsTabStrip, SETTINGS_TABS } from "./settingsShared.jsx";

export function SettingsPlaceholderTab({ tab }) {
  const meta = SETTINGS_TABS.find((t) => t.key === tab);
  const label = meta?.label || tab;
  return (
    <>
      <PageHeader
        crumbs={["System Settings", label]}
        title={`${label} Settings`}
        description={`Configure ${label.toLowerCase()} preferences for your Trukkas platform.`}
      />
      <SettingsTabStrip active={tab} />
      <Card>
        <EmptyState
          icon="hammer"
          title={`${label} settings aren't built yet`}
          description="This tab is wired into navigation, but its screen hasn't been transcribed from the source screenshots yet."
        />
      </Card>
    </>
  );
}
