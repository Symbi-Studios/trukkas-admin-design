"use client";

import { useState } from "react";
import {
  PageHeader,
  Button,
  SectionCard,
  TextField,
  Select,
  Switch,
  QuickActionsCard,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import {
  operationsStatus,
  operationsQuickActions,
} from "../mock/fixtures/settings.js";
import {
  updateJobTripSettings,
  updateBiddingAssignment,
  updateDispatchTracking,
  updateDocumentCompliance,
  updateTimingSlas,
  updateOperationsCommunication,
  saveOperationsSettings,
  resetOperationsSettings,
} from "../mock/api.js";
import {
  SettingsTabStrip,
  SettingsStatusCard,
  SettingsDangerZone,
  SettingsMetaFooter,
} from "./settingsShared.jsx";

const LOAD_TYPES = [
  "General Cargo",
  "Refrigerated",
  "Hazardous",
  "Bulk",
  "Container",
];
const TRIP_STATUSES = ["Draft", "Scheduled", "Confirmed"];
const BID_SELECTIONS = [
  "Lowest Valid Bid",
  "Highest Rated Driver",
  "Fastest Response",
  "Manual Review",
];
const TRACKING_INTERVALS = [
  "1 minute",
  "5 minutes",
  "15 minutes",
  "30 minutes",
];

function Field({ children }) {
  return <div style={{ marginBottom: 14 }}>{children}</div>;
}

export function SettingsOperations() {
  const jobTrip = useCollection("settingsJobTrip")?.[0];
  const bidding = useCollection("settingsBiddingAssignment")?.[0];
  const dispatch = useCollection("settingsDispatchTracking")?.[0];
  const docCompliance = useCollection("settingsDocumentCompliance")?.[0];
  const timing = useCollection("settingsTimingSlas")?.[0];
  const comms = useCollection("settingsOperationsCommunication")?.[0];
  const meta = useCollection("settingsMeta")?.[0];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!jobTrip || !bidding || !dispatch || !docCompliance || !timing || !comms)
    return null;

  async function handleSave() {
    setSaving(true);
    await saveOperationsSettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <PageHeader
        crumbs={["System Settings", "Operations"]}
        title="Operations Settings"
        description="Configure operational rules, workflows, and defaults for how Trukkas runs daily operations."
        actions={
          <>
            <Button
              variant="outline"
              icon="rotate-ccw"
              onClick={() => resetOperationsSettings()}
            >
              Reset to Default
            </Button>
            <Button icon="save" disabled={saving} onClick={handleSave}>
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save Changes"}
            </Button>
          </>
        }
      />
      <SettingsTabStrip active="operations" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 300px",
          gap: "var(--tk-grid-gap)",
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "var(--tk-grid-gap)",
          }}
        >
          <SectionCard title="Job & Trip Settings" icon="briefcase">
            <span
              className="tk-meta"
              style={{ display: "block", marginTop: -10, marginBottom: 14 }}
            >
              Configure how jobs and trips behave on the platform.
            </span>
            <Field>
              <TextField
                label="Default Job Expiry (Hours)"
                type="number"
                value={jobTrip.defaultJobExpiryHours}
                hint="How long a job stays open for bids."
                onChange={(e) =>
                  updateJobTripSettings({
                    defaultJobExpiryHours: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field>
              <Select
                label="Default Load Type"
                options={LOAD_TYPES}
                value={jobTrip.defaultLoadType}
                onChange={(e) =>
                  updateJobTripSettings({ defaultLoadType: e.target.value })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={jobTrip.autoCancelExpiredJobs}
                label="Auto-cancel expired jobs"
                hint="Automatically cancel jobs when they expire."
                onChange={(v) =>
                  updateJobTripSettings({ autoCancelExpiredJobs: v })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={jobTrip.requireDocumentVerification}
                label="Require document verification"
                hint="Require document verification before job activation."
                onChange={(v) =>
                  updateJobTripSettings({ requireDocumentVerification: v })
                }
              />
            </Field>
            <Field>
              <Select
                label="Default Trip Status"
                options={TRIP_STATUSES}
                value={jobTrip.defaultTripStatus}
                onChange={(e) =>
                  updateJobTripSettings({ defaultTripStatus: e.target.value })
                }
              />
            </Field>
            <Switch
              checked={jobTrip.allowMultiStopTrips}
              label="Allow multi-stop trips"
              hint="Allow multiple pickup and delivery locations."
              onChange={(v) =>
                updateJobTripSettings({ allowMultiStopTrips: v })
              }
            />
          </SectionCard>

          <SectionCard title="Bidding & Assignment" icon="gavel">
            <span
              className="tk-meta"
              style={{ display: "block", marginTop: -10, marginBottom: 14 }}
            >
              Control how bids, offers, and driver assignments work.
            </span>
            <Field>
              <TextField
                label="Default Bidding Duration (Hours)"
                type="number"
                value={bidding.defaultBiddingDurationHours}
                hint="How long bids stay open by default."
                onChange={(e) =>
                  updateBiddingAssignment({
                    defaultBiddingDurationHours: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field>
              <Select
                label="Preferred Bid Selection"
                options={BID_SELECTIONS}
                value={bidding.preferredBidSelection}
                onChange={(e) =>
                  updateBiddingAssignment({
                    preferredBidSelection: e.target.value,
                  })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={bidding.allowManualAssignment}
                label="Allow manual assignment"
                hint="Allow operations team to assign drivers manually."
                onChange={(v) =>
                  updateBiddingAssignment({ allowManualAssignment: v })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={bidding.requireDriverAcceptance}
                label="Require driver acceptance"
                hint="Driver must accept job before status moves to confirmed."
                onChange={(v) =>
                  updateBiddingAssignment({ requireDriverAcceptance: v })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={bidding.autoCancelUnacceptedJobs}
                label="Auto-cancel unaccepted jobs"
                hint="Cancel confirmed jobs if not accepted within time."
                onChange={(v) =>
                  updateBiddingAssignment({ autoCancelUnacceptedJobs: v })
                }
              />
            </Field>
            <Switch
              checked={bidding.notifyOnNewBids}
              label="Notify on new bids"
              hint="Send alerts when new bids are received."
              onChange={(v) => updateBiddingAssignment({ notifyOnNewBids: v })}
            />
          </SectionCard>

          <SectionCard title="Dispatch & Tracking" icon="radio-tower">
            <span
              className="tk-meta"
              style={{ display: "block", marginTop: -10, marginBottom: 14 }}
            >
              Configure dispatch, trip tracking, and live operations.
            </span>
            <Field>
              <Switch
                checked={dispatch.enableDispatchApproval}
                label="Enable dispatch approval"
                hint="Require admin approval before dispatch."
                onChange={(v) =>
                  updateDispatchTracking({ enableDispatchApproval: v })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={dispatch.liveLocationTracking}
                label="Live location tracking"
                hint="Track driver location during active trips."
                onChange={(v) =>
                  updateDispatchTracking({ liveLocationTracking: v })
                }
              />
            </Field>
            <Field>
              <Select
                label="Tracking update interval"
                options={TRACKING_INTERVALS}
                value={dispatch.trackingUpdateInterval}
                onChange={(e) =>
                  updateDispatchTracking({
                    trackingUpdateInterval: e.target.value,
                  })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={dispatch.allowTripReRouting}
                label="Allow trip re-routing"
                hint="Allow ops team to update trip route."
                onChange={(v) =>
                  updateDispatchTracking({ allowTripReRouting: v })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={dispatch.requirePod}
                label="Require POD (Proof of Delivery)"
                hint="Mark trip as completed only after POD is uploaded."
                onChange={(v) => updateDispatchTracking({ requirePod: v })}
              />
            </Field>
            <Switch
              checked={dispatch.autoCompleteTrip}
              label="Auto-complete trip"
              hint="Automatically complete trip after POD verification."
              onChange={(v) => updateDispatchTracking({ autoCompleteTrip: v })}
            />
          </SectionCard>

          <SectionCard title="Document & Compliance" icon="file-text">
            <span
              className="tk-meta"
              style={{ display: "block", marginTop: -10, marginBottom: 14 }}
            >
              Set document and compliance requirements for jobs and trips.
            </span>
            <Field>
              <TextField
                label="Required documents for job creation"
                value={docCompliance.requiredDocsForJobCreation}
                onChange={(e) =>
                  updateDocumentCompliance({
                    requiredDocsForJobCreation: e.target.value,
                  })
                }
              />
            </Field>
            <Field>
              <TextField
                label="Required documents for trip start"
                value={docCompliance.requiredDocsForTripStart}
                onChange={(e) =>
                  updateDocumentCompliance({
                    requiredDocsForTripStart: e.target.value,
                  })
                }
              />
            </Field>
            <Field>
              <TextField
                label="Required documents for trip completion"
                value={docCompliance.requiredDocsForTripCompletion}
                onChange={(e) =>
                  updateDocumentCompliance({
                    requiredDocsForTripCompletion: e.target.value,
                  })
                }
              />
            </Field>
            {/* <Switch
              checked={docCompliance.verifyDocumentsAutomatically}
              label="Verify documents automatically"
              hint="Use OCR/AI to validate documents."
              onChange={(v) =>
                updateDocumentCompliance({ verifyDocumentsAutomatically: v })
              }
            /> */}
          </SectionCard>

          <SectionCard title="Timing & SLAs" icon="clock">
            <span
              className="tk-meta"
              style={{ display: "block", marginTop: -10, marginBottom: 14 }}
            >
              Set operational timelines and service level agreements.
            </span>
            <Field>
              <TextField
                label="Default loading time (Hours)"
                type="number"
                value={timing.defaultLoadingTimeHours}
                onChange={(e) =>
                  updateTimingSlas({
                    defaultLoadingTimeHours: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field>
              <TextField
                label="Default unloading time (Hours)"
                type="number"
                value={timing.defaultUnloadingTimeHours}
                onChange={(e) =>
                  updateTimingSlas({
                    defaultUnloadingTimeHours: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field>
              <TextField
                label="Delay threshold (Hours)"
                type="number"
                value={timing.delayThresholdHours}
                hint="Trigger delay alerts after this period."
                onChange={(e) =>
                  updateTimingSlas({
                    delayThresholdHours: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={timing.autoFlagPotentialDelays}
                label="Auto-flag potential delays"
                hint="Notify operations team of delayed trips."
                onChange={(v) =>
                  updateTimingSlas({ autoFlagPotentialDelays: v })
                }
              />
            </Field>
            <Switch
              checked={timing.enableSlaTracking}
              label="Enable SLA tracking"
              hint="Track and report on delivery performance."
              onChange={(v) => updateTimingSlas({ enableSlaTracking: v })}
            />
          </SectionCard>

          <SectionCard title="Communication" icon="message-square">
            <span
              className="tk-meta"
              style={{ display: "block", marginTop: -10, marginBottom: 14 }}
            >
              Configure communication settings for operations.
            </span>
            <Field>
              <Switch
                checked={comms.sendJobAssignmentNotifications}
                label="Send job assignment notifications"
                hint="Notify drivers and customers on assignment."
                onChange={(v) =>
                  updateOperationsCommunication({
                    sendJobAssignmentNotifications: v,
                  })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={comms.sendTripStatusUpdates}
                label="Send trip status updates"
                hint="Notify stakeholders of trip status changes."
                onChange={(v) =>
                  updateOperationsCommunication({ sendTripStatusUpdates: v })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={comms.sendDelayAlerts}
                label="Send delay alerts"
                hint="Notify relevant parties about delays."
                onChange={(v) =>
                  updateOperationsCommunication({ sendDelayAlerts: v })
                }
              />
            </Field>
            <Field>
              <Switch
                checked={comms.sendCompletionNotifications}
                label="Send completion notifications"
                hint="Notify customer and driver on completion."
                onChange={(v) =>
                  updateOperationsCommunication({
                    sendCompletionNotifications: v,
                  })
                }
              />
            </Field>
            <Switch
              checked={comms.enableInAppChat}
              label="Enable in-app chat"
              hint="Allow direct communication between ops and drivers."
              onChange={(v) =>
                updateOperationsCommunication({ enableInAppChat: v })
              }
            />
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }}>
          <SettingsStatusCard
            title="Operations Status"
            headline={operationsStatus.headline}
            caption={operationsStatus.caption}
            items={operationsStatus.items}
          />
          <QuickActionsCard items={operationsQuickActions} />
          <SettingsDangerZone
            title="Reset Operations Settings"
            hint="Restore all operational settings to default values."
            onConfirm={() => resetOperationsSettings()}
          />
          <SettingsMetaFooter meta={meta} />
        </div>
      </div>
    </>
  );
}
