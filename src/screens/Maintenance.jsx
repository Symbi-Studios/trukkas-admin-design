"use client";
import { useState } from "react";
import { useSelector } from "react-redux";
import { Button, DropdownMenu, PageHeader, Tabs } from "../ds.js";
import { useGetAdminMaintenanceStatsQuery } from "../store/features/maintenance/maintenanceApi.js";
import { MaintenanceActionDialogs } from "./MaintenanceActionDialogs.jsx";
import { Overview } from "./maintenance/Overview.jsx";
import { FleetCompliance } from "./maintenance/FleetCompliance.jsx";
import { ServiceRecords } from "./maintenance/ServiceRecords.jsx";
import { Reviews } from "./maintenance/Reviews.jsx";
import { Rules } from "./maintenance/Rules.jsx";
import { Exceptions } from "./maintenance/Exceptions.jsx";
import { VIEWS, useMaintenanceView, useToast } from "./maintenance/shared.jsx";
import "./Maintenance.css";

/**
 * Fleet Maintenance for Trukkas admins.
 * Rules decide when each truck is due; the backend blocks trucks with an
 * overdue mandatory requirement from new jobs; companies schedule and complete
 * servicing; admins approve requests, verify completions and own exceptions.
 */
export function Maintenance() {
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const canWrite = ["SUPER_ADMIN", "OPS_ADMIN"].includes(role);
  const [view, go] = useMaintenanceView();
  const [toast, notify] = useToast();
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [openNewRule, setOpenNewRule] = useState(false);
  const stats = useGetAdminMaintenanceStatsQuery(owner, { skip: !authenticated });
  const reviewCount = stats.error ? null : stats.currentData?.approvals?.total;
  const shared = { owner, authenticated, canWrite, role, notify, go };

  return (
    <div className="maint-page">
      <PageHeader
        crumbs={["Fleet", "Fleet Maintenance"]}
        title="Fleet Maintenance"
        description="Rules decide when each truck is due. Trucks with overdue mandatory maintenance cannot take new jobs until servicing is verified."
        actions={
          <>
            <span style={{ position: "relative" }}>
              <Button variant="outline" iconRight="chevron-down" onClick={() => setMenu((v) => !v)}>More</Button>
              {menu && (
                <span style={{ position: "absolute", right: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu
                    width={220}
                    items={[
                      { label: "Maintenance calendar", icon: "calendar", onClick: () => { setMenu(false); setDialog("calendar"); } },
                      { label: "Service centers", icon: "building-2", onClick: () => { setMenu(false); setDialog("centers"); } },
                    ]}
                  />
                </span>
              )}
            </span>
            {role === "SUPER_ADMIN" && <Button icon="plus" onClick={() => { go("rules"); setOpenNewRule(true); }}>New Rule</Button>}
          </>
        }
      />
      <Tabs
        value={view}
        onChange={(next) => go(next)}
        items={VIEWS.map((item) => (item.value === "reviews" && reviewCount ? { ...item, count: reviewCount } : item))}
      />
      {view === "overview" && <Overview {...shared} />}
      {view === "fleet" && <FleetCompliance {...shared} />}
      {view === "records" && <ServiceRecords key={typeof window === "undefined" ? "records" : window.location.search} {...shared} />}
      {view === "reviews" && <Reviews {...shared} />}
      {view === "rules" && <Rules {...shared} openNew={openNewRule} onOpenedNew={() => setOpenNewRule(false)} />}
      {view === "exceptions" && <Exceptions {...shared} />}
      {dialog && <MaintenanceActionDialogs kind={dialog} owner={owner} role={role} onClose={() => setDialog(null)} />}
      {toast && <div className="maint-toast" role="status">{toast}</div>}
    </div>
  );
}
