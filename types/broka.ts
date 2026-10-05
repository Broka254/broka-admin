export type UnknownApiRecord = Record<string, unknown>;

export type LoginInput = { phone: string; password: string };
export type TokenEnvelope = { accessToken: string; refreshToken?: string };
export type AdminIdentity = { isAdmin: true; displayName: string; roleLabel: string };

export type ApiResource =
  | "summary" | "users" | "aiSavings" | "ledgerIntegrity" | "auditLogs" | "fraudEvents" | "transactions"
  | "workflowVersions" | "eventMetrics" | "eventCatalog" | "econfirmDiagnostics" | "clientIpDiagnostics" | "health";

export type ApiAvailability = "available" | "not-configured" | "not-documented" | "unauthorized" | "forbidden" | "unavailable";
export type ResourceAvailability = { resource: ApiResource; availability: ApiAvailability; detail: string };
