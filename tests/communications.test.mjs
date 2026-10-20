import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());

test("communications schemas validate all required payload contracts", async () => {
  const schemasFile = await readFile(resolve(root, "lib/api/schemas.ts"), "utf8");
  
  // Verify all Zod schema declarations exist
  const expectedSchemas = [
    "AudienceKindSchema",
    "AudienceInSchema",
    "AudiencePreviewInSchema",
    "AudiencePreviewOutSchema",
    "CommunicationTypeSchema",
    "CommunicationSeveritySchema",
    "CommunicationChannelSchema",
    "CommunicationStatusSchema",
    "RecipientStatusSchema",
    "CommunicationCreateInSchema",
    "CommunicationUpdateInSchema",
    "ScheduleInSchema",
    "ReasonInSchema",
    "RetryInSchema",
    "CommunicationOutSchema",
    "CommunicationListSchema",
    "DeliverySummaryOutSchema",
    "CommunicationDetailSchema",
    "RecipientOutSchema",
    "RecipientPageSchema",
    "CommunicationStatsSchema",
    "PublishOutSchema",
    "RetryOutSchema",
    "WorkerDiagnosticsSchema",
  ];

  for (const schemaName of expectedSchemas) {
    assert.ok(schemasFile.includes(`export const ${schemaName}`), `missing schema ${schemaName}`);
  }

  // Deep link validation checks
  assert.ok(schemasFile.includes("function isValidDeepLink"), "missing isValidDeepLink function");
  assert.match(schemasFile, /broka\.co\.ke/, "deep link must check broka.co.ke");
  assert.match(schemasFile, /broka:\/\//, "deep link must support broka:// custom scheme");
});

test("communications push payload limit is enforced at 3600 UTF-8 bytes", async () => {
  const schemasFile = await readFile(resolve(root, "lib/api/schemas.ts"), "utf8");
  assert.match(schemasFile, /3600/, "must enforce 3600 byte push limit");
  assert.match(schemasFile, /TextEncoder/, "must use TextEncoder for UTF-8 byte counting");
});

test("admin resource registry includes all communications endpoints and detail patterns", async () => {
  const adminFile = await readFile(resolve(root, "lib/api/admin.ts"), "utf8");
  
  // Static endpoints
  assert.ok(adminFile.includes('communications: "/admin/communications"'), "missing communications endpoint");
  assert.ok(adminFile.includes('workerDiagnostics: "/admin/communications/diagnostics/worker"'), "missing worker diagnostics endpoint");
  
  // Detail patterns
  assert.ok(adminFile.includes('resource: "communicationDetail"'), "missing communicationDetail pattern");
  assert.ok(adminFile.includes('resource: "communicationRecipients"'), "missing communicationRecipients pattern");
  assert.ok(adminFile.includes('resource: "communicationStats"'), "missing communicationStats pattern");
});

test("server-side proxy allowlists communications mutations and enforces security boundaries", async () => {
  const proxyFile = await readFile(resolve(root, "app/api/broka/[...path]/route.ts"), "utf8");
  const boundedBodyFile = await readFile(resolve(root, "lib/http/bounded-body.ts"), "utf8");
  
  // CSRF enforcement
  assert.match(proxyFile, /requireSameOrigin\(request\)/, "proxy mutations must enforce requireSameOrigin CSRF check");
  
  // Payload size limit
  assert.match(proxyFile, /MAX_PAYLOAD_BYTES/, "proxy must define MAX_PAYLOAD_BYTES");
  assert.match(proxyFile, /512 \* 1024/, "proxy payload limit must be 512KB");
  assert.match(proxyFile, /readBoundedJsonBody/, "proxy must read bodies through bounded parsing");
  assert.match(boundedBodyFile, /payload_too_large/, "bounded parser must reject oversized bodies");
  
  // Idempotency key forwarding
  assert.match(proxyFile, /x-idempotency-key/, "proxy must extract x-idempotency-key header");
  assert.match(proxyFile, /upstreamHeaders\["X-Idempotency-Key"\]/, "proxy must forward X-Idempotency-Key upstream");
  
  // All 8 mutation operations registered
  const mutationOperations = [
    "admin\\/communications\\/preview",
    "admin\\/communications$",
    "admin\\/communications\\/([A-Za-z0-9._-]+)$",
    "admin\\/communications\\/([A-Za-z0-9._-]+)\\/schedule",
    "admin\\/communications\\/([A-Za-z0-9._-]+)\\/publish",
    "admin\\/communications\\/([A-Za-z0-9._-]+)\\/cancel",
    "admin\\/communications\\/([A-Za-z0-9._-]+)\\/complete",
    "admin\\/communications\\/([A-Za-z0-9._-]+)\\/recipients\\/retry",
  ];
  for (const op of mutationOperations) {
    assert.ok(proxyFile.includes(op), `missing proxy mutation operation: ${op}`);
  }

  // Response contract validation
  assert.match(proxyFile, /contract_validation_failed/, "proxy must return contract_validation_failed on schema mismatch");
  assert.match(proxyFile, /event: "admin_contract_validation_failed"/, "proxy must log contract validation failure event");
  
  // Clear session on 401
  assert.match(proxyFile, /clearSession/, "proxy must clear cookies on 401");
});

test("client mutation helpers manage idempotency and map errors cleanly", async () => {
  const commApi = await readFile(resolve(root, "lib/api/communications.ts"), "utf8");
  for (const fn of [
    "previewAudience",
    "createCommunication",
    "updateCommunication",
    "scheduleCommunication",
    "publishCommunication",
    "cancelCommunication",
    "completeCommunication",
    "retryRecipients",
  ]) {
    assert.ok(commApi.includes(`export async function ${fn}`), `missing client helper ${fn}`);
  }
  assert.match(commApi, /X-Idempotency-Key/, "client helper must set X-Idempotency-Key header");
  assert.match(commApi, /AdminRequestError/, "client helper must throw AdminRequestError on failure");
});

test("communications workspace provides overview, filters, diagnostics, and creation controls", async () => {
  const pageFile = await readFile(resolve(root, "app/(dashboard)/communications/page.tsx"), "utf8");
  
  // Hooks
  assert.match(pageFile, /useAdminCommunications/, "must use useAdminCommunications hook");
  assert.match(pageFile, /isEndpointMissing/, "must check for missing endpoint");
  
  // Action triggers
  assert.match(pageFile, /Worker Diagnostics/, "must provide Worker Diagnostics button");
  assert.match(pageFile, /New Communication/, "must provide New Communication button");
  
  // Filters
  assert.match(pageFile, /statusFilter/, "must have status filter");
  assert.match(pageFile, /typeFilter/, "must have type filter");
  assert.match(pageFile, /severityFilter/, "must have severity filter");
  assert.match(pageFile, /searchQuery/, "must have search filter");
  assert.match(pageFile, /clearAllFilters/, "must have clear filters action");
  
  // Dialogs
  assert.match(pageFile, /CommunicationFormDialog/, "must include form dialog");
  assert.match(pageFile, /CommunicationDetailDialog/, "must include detail dialog");
  assert.match(pageFile, /WorkerDiagnosticsDialog/, "must include worker diagnostics dialog");
});

test("form dialog implements client validation, current audience preview, retry identity, and concurrent edit protection", async () => {
  const formFile = await readFile(resolve(root, "components/dashboard/communications/communication-form-dialog.tsx"), "utf8");
  
  // Validations
  assert.match(formFile, /160/, "title limit must be 160 characters");
  assert.match(formFile, /10000|10,000/, "body limit must be 10000 characters");
  assert.match(formFile, /3600/, "push byte limit must be 3600 bytes");
  assert.match(formFile, /useAudiencePreview/, "form must use the current audience preview hook");
  
  // Concurrent edit protection
  assert.match(formFile, /expected_version/, "form must pass expected_version when updating");
  assert.match(formFile, /IdempotencyKeyLedger/, "form must keep a stable key for retries of the same logical mutation");
  assert.match(formFile, /SingleFlight/, "form must prevent duplicate in-flight submissions");
  assert.match(formFile, /audiencePreview/, "form must use the current audience preview hook");
});

test("detail view preserves delivery truthfulness and does not claim device confirmation", async () => {
  const detailFile = await readFile(resolve(root, "components/dashboard/communications/communication-detail-dialog.tsx"), "utf8");
  const evidenceFile = await readFile(resolve(root, "components/dashboard/communications/delivery-evidence.tsx"), "utf8");
  const incidentFile = await readFile(resolve(root, "components/dashboard/communications/incident-lifecycle-notice.tsx"), "utf8");
  
  // Delivery telemetry distinctions
  assert.match(detailFile, /DeliveryEvidenceGrid/, "must render the shared delivery evidence grid");
  assert.match(evidenceFile, /Total Recipients/, "must display Total Recipients");
  assert.match(evidenceFile, /In-App Reads/, "must display In-App Reads");
  assert.match(evidenceFile, /FCM Accepted/, "must display FCM Accepted");
  assert.match(evidenceFile, /Device Delivery Evidence/, "must label unavailable device evidence");
  assert.match(evidenceFile, /Unavailable/, "must not substitute confirmed_delivered for device evidence");
  assert.doesNotMatch(evidenceFile, /Confirmed Device/, "must not claim confirmed device delivery");
  
  // Recipient ledger
  assert.match(detailFile, /Recipient Ledger/, "must include Recipient Ledger section");
  assert.match(detailFile, /recipientStatusFilter/, "must filter recipient ledger by status");
  assert.match(detailFile, /Retry Selected/, "must provide targeted retry action");
  assert.match(detailFile, /retry_eligible/, "must inspect retry_eligible flag");
  
  // Documented backend gap
  assert.match(detailFile, /IncidentLifecycleNotice/, "must render the incident lifecycle warning");
  assert.match(incidentFile, /complete_published_communications/, "must cite the backend function with the gap");
  assert.match(incidentFile, /delivery campaign does\s+not prove the operational incident was resolved/i, "must distinguish delivery completion from incident resolution");
});

test("worker diagnostics dialog displays engine profile, backlog, and last pass telemetry", async () => {
  const diagFile = await readFile(resolve(root, "components/dashboard/communications/worker-diagnostics-dialog.tsx"), "utf8");
  
  assert.match(diagFile, /useAdminWorkerDiagnostics/, "must call useAdminWorkerDiagnostics");
  assert.match(diagFile, /Engine Runtime Profile/, "must show engine profile");
  assert.match(diagFile, /Queue Backlog/, "must show backlog");
  assert.match(diagFile, /Last Sweep Pass/, "must show last sweep pass statistics");
  assert.match(diagFile, /pending_recipients/, "must show pending recipients count");
});
