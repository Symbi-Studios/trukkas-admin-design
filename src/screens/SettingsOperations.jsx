"use client";

;
import { Button } from '../ds.js';
import { SettingsTextField as TextField, SettingsSelect as Select, SettingsSwitch as Switch, SettingsReadNotice } from './settingsValues.jsx';
import { useSettingsEditor } from './useSettingsEditor.js';


import { SettingsSectionHeader, SettingsPanelLoading, SettingsGrid, SettingsCard, SettingsCardSave } from './settingsShared.jsx';

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
  const editor = useSettingsEditor('operations');
  const updateJobTripSettings = editor.change('settingsJobTrip');
  const updateBiddingAssignment = editor.change('settingsBiddingAssignment');
  const updateDispatchTracking = editor.change('settingsDispatchTracking');
  const updateDocumentCompliance = editor.change('settingsDocumentCompliance');
  const updateTimingSlas = editor.change('settingsTimingSlas');
  const updateOperationsCommunication = editor.change('settingsOperationsCommunication');
  const resetOperationsSettings = () => editor.reset();
  const jobTrip = editor.group('settingsJobTrip');
  const bidding = editor.group('settingsBiddingAssignment');
  const dispatch = editor.group('settingsDispatchTracking');
  const docCompliance = editor.group('settingsDocumentCompliance');
  const timing = editor.group('settingsTimingSlas');
  const comms = editor.group('settingsOperationsCommunication');

  if (editor.loading) return <SettingsPanelLoading />;
  if (!jobTrip || !bidding || !dispatch || !docCompliance || !timing || !comms)
    return null;


  return (
    <>
      <SettingsSectionHeader
        title="Operations"
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
          </>
        }
      />
      <SettingsReadNotice error={editor.error} />

      <SettingsGrid>
        {editor.groupVisible('settingsJobTrip') && (<SettingsCard description="Configure how jobs and trips behave on the platform." title="Job & Trip Settings" save={<SettingsCardSave editor={editor} group="settingsJobTrip" />}>
          {editor.visible('settingsJobTrip', 'defaultJobExpiryHours') && (<Field>
            <TextField
              label="Default Job Expiry (Hours)"
              type="number"
              value={jobTrip.defaultJobExpiryHours}
              hint="How long a job stays open for bids."
              onChange={(e) =>
                updateJobTripSettings({
                  defaultJobExpiryHours: e.target.value,
                })
              }
            />
          </Field>) }
          {editor.visible('settingsJobTrip', 'defaultLoadType') && (<Field>
            <Select
              label="Default Load Type"
              options={LOAD_TYPES}
              value={jobTrip.defaultLoadType}
              onChange={(e) =>
                updateJobTripSettings({ defaultLoadType: e.target.value })
              }
            />
          </Field>) }
          {editor.visible('settingsJobTrip', 'autoCancelExpiredJobs') && (<Field>
            <Switch
              checked={jobTrip.autoCancelExpiredJobs}
              label="Auto-cancel expired jobs"
              hint="Automatically cancel jobs when they expire."
              onChange={(v) =>
                updateJobTripSettings({ autoCancelExpiredJobs: v })
              }
            />
          </Field>) }
          {editor.visible('settingsJobTrip', 'requireDocumentVerification') && (<Field>
            <Switch
              checked={jobTrip.requireDocumentVerification}
              label="Require document verification"
              hint="Require document verification before job activation."
              onChange={(v) =>
                updateJobTripSettings({ requireDocumentVerification: v })
              }
            />
          </Field>) }
          {editor.visible('settingsJobTrip', 'defaultTripStatus') && (<Field>
            <Select
              label="Default Trip Status"
              options={TRIP_STATUSES}
              value={jobTrip.defaultTripStatus}
              onChange={(e) =>
                updateJobTripSettings({ defaultTripStatus: e.target.value })
              }
            />
          </Field>) }
          {editor.visible('settingsJobTrip', 'enableDriverRatings') && (<Field>
            <Switch
              checked={jobTrip.enableDriverRatings}
              label="Enable driver ratings"
              hint="Allow shippers to rate drivers after delivery."
              onChange={(v) =>
                updateJobTripSettings({ enableDriverRatings: v })
              }
            />
          </Field>) }
          {editor.visible('settingsJobTrip', 'allowMultiStopTrips') && (<Switch
            checked={jobTrip.allowMultiStopTrips}
            label="Allow multi-stop trips"
            hint="Allow multiple pickup and delivery locations."
            onChange={(v) =>
              updateJobTripSettings({ allowMultiStopTrips: v })
            }
          />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsBiddingAssignment') && (<SettingsCard description="Control how bids, offers, and driver assignments work." title="Bidding & Assignment" save={<SettingsCardSave editor={editor} group="settingsBiddingAssignment" />}>
          {editor.visible('settingsBiddingAssignment', 'defaultBiddingDurationHours') && (<Field>
            <TextField
              label="Default Bidding Duration (Hours)"
              type="number"
              value={bidding.defaultBiddingDurationHours}
              hint="How long bids stay open by default."
              onChange={(e) =>
                updateBiddingAssignment({
                  defaultBiddingDurationHours: e.target.value,
                })
              }
            />
          </Field>) }
          {editor.visible('settingsBiddingAssignment', 'preferredBidSelection') && (<Field>
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
          </Field>) }
          {editor.visible('settingsBiddingAssignment', 'autoAssignJobs') && (<Field>
            <Switch
              checked={bidding.autoAssignJobs}
              label="Auto-assign jobs"
              hint="Automatically assign jobs to preferred partners."
              onChange={(v) => updateBiddingAssignment({ autoAssignJobs: v })}
            />
          </Field>) }
          {editor.visible('settingsBiddingAssignment', 'allowPartialBids') && (<Field>
            <Switch
              checked={bidding.allowPartialBids}
              label="Allow partial bids"
              hint="Allow bidders to submit partial bids."
              onChange={(v) => updateBiddingAssignment({ allowPartialBids: v })}
            />
          </Field>) }
          {editor.visible('settingsBiddingAssignment', 'allowManualAssignment') && (<Field>
            <Switch
              checked={bidding.allowManualAssignment}
              label="Allow manual assignment"
              hint="Allow operations team to assign drivers manually."
              onChange={(v) =>
                updateBiddingAssignment({ allowManualAssignment: v })
              }
            />
          </Field>) }
          {editor.visible('settingsBiddingAssignment', 'requireDriverAcceptance') && (<Field>
            <Switch
              checked={bidding.requireDriverAcceptance}
              label="Require driver acceptance"
              hint="Driver must accept job before status moves to confirmed."
              onChange={(v) =>
                updateBiddingAssignment({ requireDriverAcceptance: v })
              }
            />
          </Field>) }
          {editor.visible('settingsBiddingAssignment', 'autoCancelUnacceptedJobs') && (<Field>
            <Switch
              checked={bidding.autoCancelUnacceptedJobs}
              label="Auto-cancel unaccepted jobs"
              hint="Cancel confirmed jobs if not accepted within time."
              onChange={(v) =>
                updateBiddingAssignment({ autoCancelUnacceptedJobs: v })
              }
            />
          </Field>) }
          {editor.visible('settingsBiddingAssignment', 'notifyOnNewBids') && (<Switch
            checked={bidding.notifyOnNewBids}
            label="Notify on new bids"
            hint="Send alerts when new bids are received."
            onChange={(v) => updateBiddingAssignment({ notifyOnNewBids: v })}
          />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsDispatchTracking') && (<SettingsCard description="Configure dispatch, trip tracking, and live operations." title="Dispatch & Tracking" save={<SettingsCardSave editor={editor} group="settingsDispatchTracking" />}>
          {editor.visible('settingsDispatchTracking', 'enableDispatchApproval') && (<Field>
            <Switch
              checked={dispatch.enableDispatchApproval}
              label="Enable dispatch approval"
              hint="Require admin approval before dispatch."
              onChange={(v) =>
                updateDispatchTracking({ enableDispatchApproval: v })
              }
            />
          </Field>) }
          {editor.visible('settingsDispatchTracking', 'liveLocationTracking') && (<Field>
            <Switch
              checked={dispatch.liveLocationTracking}
              label="Live location tracking"
              hint="Track driver location during active trips."
              onChange={(v) =>
                updateDispatchTracking({ liveLocationTracking: v })
              }
            />
          </Field>) }
          {editor.visible('settingsDispatchTracking', 'trackingUpdateInterval') && (<Field>
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
          </Field>) }
          {editor.visible('settingsDispatchTracking', 'enableGeofencing') && (<Field>
            <Switch
              checked={dispatch.enableGeofencing}
              label="Enable geofencing"
              hint="Use location-based checks for trip updates."
              onChange={(v) => updateDispatchTracking({ enableGeofencing: v })}
            />
          </Field>) }
          {editor.visible('settingsDispatchTracking', 'allowTripReRouting') && (<Field>
            <Switch
              checked={dispatch.allowTripReRouting}
              label="Allow trip re-routing"
              hint="Allow ops team to update trip route."
              onChange={(v) =>
                updateDispatchTracking({ allowTripReRouting: v })
              }
            />
          </Field>) }
          {editor.visible('settingsDispatchTracking', 'requirePod') && (<Field>
            <Switch
              checked={dispatch.requirePod}
              label="Require POD (Proof of Delivery)"
              hint="Mark trip as completed only after POD is uploaded."
              onChange={(v) => updateDispatchTracking({ requirePod: v })}
            />
          </Field>) }
          {editor.visible('settingsDispatchTracking', 'autoCompleteTrip') && (<Switch
            checked={dispatch.autoCompleteTrip}
            label="Auto-complete trip"
            hint="Automatically complete trip after POD verification."
            onChange={(v) => updateDispatchTracking({ autoCompleteTrip: v })}
          />) }
          {/* Formerly on General; hidden when the backend exposes autoCompleteTrip as well. */}
          {!editor.visible('settingsDispatchTracking', 'autoCompleteTrip') && editor.visible('settingsDispatchTracking', 'autoCompleteTrips') && (<Switch
            checked={dispatch.autoCompleteTrips}
            label="Auto-complete trips"
            hint="Mark trip as completed after POD upload."
            onChange={(v) => updateDispatchTracking({ autoCompleteTrips: v })}
          />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsDocumentCompliance') && (<SettingsCard description="Set document and compliance requirements for jobs and trips." title="Document & Compliance" save={<SettingsCardSave editor={editor} group="settingsDocumentCompliance" />}>
          {editor.visible('settingsDocumentCompliance', 'requiredDocsForJobCreation') && (<Field>
            <TextField
              label="Required documents for job creation"
              value={docCompliance.requiredDocsForJobCreation}
              onChange={(e) =>
                updateDocumentCompliance({
                  requiredDocsForJobCreation: e.target.value,
                })
              }
            />
          </Field>) }
          {editor.visible('settingsDocumentCompliance', 'requiredDocsForTripStart') && (<Field>
            <TextField
              label="Required documents for trip start"
              value={docCompliance.requiredDocsForTripStart}
              onChange={(e) =>
                updateDocumentCompliance({
                  requiredDocsForTripStart: e.target.value,
                })
              }
            />
          </Field>) }
          {editor.visible('settingsDocumentCompliance', 'requiredDocsForTripCompletion') && (<Field>
            <TextField
              label="Required documents for trip completion"
              value={docCompliance.requiredDocsForTripCompletion}
              onChange={(e) =>
                updateDocumentCompliance({
                  requiredDocsForTripCompletion: e.target.value,
                })
              }
            />
          </Field>) }
          {/* <Switch
            checked={docCompliance.verifyDocumentsAutomatically}
            label="Verify documents automatically"
            hint="Use OCR/AI to validate documents."
            onChange={(v) =>
              updateDocumentCompliance({ verifyDocumentsAutomatically: v })
            }
          /> */}
        </SettingsCard>) }

        {editor.groupVisible('settingsTimingSlas') && (<SettingsCard description="Set operational timelines and service level agreements." title="Timing & SLAs" save={<SettingsCardSave editor={editor} group="settingsTimingSlas" />}>
          {editor.visible('settingsTimingSlas', 'defaultLoadingTimeHours') && (<Field>
            <TextField
              label="Default loading time (Hours)"
              type="number"
              value={timing.defaultLoadingTimeHours}
              onChange={(e) =>
                updateTimingSlas({
                  defaultLoadingTimeHours: e.target.value,
                })
              }
            />
          </Field>) }
          {editor.visible('settingsTimingSlas', 'defaultUnloadingTimeHours') && (<Field>
            <TextField
              label="Default unloading time (Hours)"
              type="number"
              value={timing.defaultUnloadingTimeHours}
              onChange={(e) =>
                updateTimingSlas({
                  defaultUnloadingTimeHours: e.target.value,
                })
              }
            />
          </Field>) }
          {editor.visible('settingsTimingSlas', 'delayThresholdHours') && (<Field>
            <TextField
              label="Delay threshold (Hours)"
              type="number"
              value={timing.delayThresholdHours}
              hint="Trigger delay alerts after this period."
              onChange={(e) =>
                updateTimingSlas({
                  delayThresholdHours: e.target.value,
                })
              }
            />
          </Field>) }
          {editor.visible('settingsTimingSlas', 'autoFlagPotentialDelays') && (<Field>
            <Switch
              checked={timing.autoFlagPotentialDelays}
              label="Auto-flag potential delays"
              hint="Notify operations team of delayed trips."
              onChange={(v) =>
                updateTimingSlas({ autoFlagPotentialDelays: v })
              }
            />
          </Field>) }
          {editor.visible('settingsTimingSlas', 'enableSlaTracking') && (<Switch
            checked={timing.enableSlaTracking}
            label="Enable SLA tracking"
            hint="Track and report on delivery performance."
            onChange={(v) => updateTimingSlas({ enableSlaTracking: v })}
          />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsOperationsCommunication') && (<SettingsCard description="Configure communication settings for operations." title="Communication" save={<SettingsCardSave editor={editor} group="settingsOperationsCommunication" />}>
          {editor.visible('settingsOperationsCommunication', 'sendJobAssignmentNotifications') && (<Field>
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
          </Field>) }
          {editor.visible('settingsOperationsCommunication', 'sendTripStatusUpdates') && (<Field>
            <Switch
              checked={comms.sendTripStatusUpdates}
              label="Send trip status updates"
              hint="Notify stakeholders of trip status changes."
              onChange={(v) =>
                updateOperationsCommunication({ sendTripStatusUpdates: v })
              }
            />
          </Field>) }
          {editor.visible('settingsOperationsCommunication', 'sendDelayAlerts') && (<Field>
            <Switch
              checked={comms.sendDelayAlerts}
              label="Send delay alerts"
              hint="Notify relevant parties about delays."
              onChange={(v) =>
                updateOperationsCommunication({ sendDelayAlerts: v })
              }
            />
          </Field>) }
          {editor.visible('settingsOperationsCommunication', 'sendCompletionNotifications') && (<Field>
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
          </Field>) }
          {editor.visible('settingsOperationsCommunication', 'enableInAppChat') && (<Switch
            checked={comms.enableInAppChat}
            label="Enable in-app chat"
            hint="Allow direct communication between ops and drivers."
            onChange={(v) =>
              updateOperationsCommunication({ enableInAppChat: v })
            }
          />) }
        </SettingsCard>) }
      </SettingsGrid>
    </>
  );
}
