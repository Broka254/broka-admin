import {
  AudienceInSchema,
  type AudienceIn,
  type AudienceKind,
  type AudiencePreviewOut,
} from "@/lib/api/schemas";
import { stableSerialize } from "@/lib/communications/idempotency";

export type AudiencePreviewSnapshot = {
  definitionKey: string;
  result: AudiencePreviewOut;
};

export function parseExplicitUserIds(value: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const raw of value.split(/[\n,]/)) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function normalizeAudienceDefinition(kind: AudienceKind, explicitIds: string[]): AudienceIn {
  return kind === "user_ids"
    ? { kind, user_ids: Array.from(new Set(explicitIds.map((id) => id.trim()).filter(Boolean))) }
    : { kind, user_ids: [] };
}

export function audienceDefinitionKey(audience: AudienceIn): string {
  return stableSerialize(normalizeAudienceDefinition(audience.kind, audience.user_ids));
}

export function audienceValidationError(audience: AudienceIn): string | null {
  const parsed = AudienceInSchema.safeParse(audience);
  if (parsed.success) return null;
  if (audience.kind === "user_ids" && audience.user_ids.length === 0) {
    return "Specific user IDs audience requires at least one user ID.";
  }
  if (audience.user_ids.length > 5000) {
    return "Explicit audience limit is 5,000 user IDs.";
  }
  return parsed.error.issues[0]?.message ?? "The audience definition is invalid.";
}

export function isAudiencePreviewCurrent(
  preview: AudiencePreviewSnapshot | null,
  currentDefinitionKey: string,
): preview is AudiencePreviewSnapshot {
  return Boolean(preview && preview.definitionKey === currentDefinitionKey);
}

export function canPublishWithPreview(
  preview: AudiencePreviewSnapshot | null,
  currentDefinitionKey: string,
): boolean {
  return isAudiencePreviewCurrent(preview, currentDefinitionKey) && preview.result.allowed;
}
