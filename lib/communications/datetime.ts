const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function partsInTimeZone(date: Date, timeZone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Partial<DateTimeParts>;

  if (
    values.year === undefined ||
    values.month === undefined ||
    values.day === undefined ||
    values.hour === undefined ||
    values.minute === undefined ||
    values.second === undefined
  ) {
    throw new Error("Unable to resolve local date/time components.");
  }

  return values as DateTimeParts;
}

function asUtcMillis(parts: DateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function sameParts(left: DateTimeParts, right: DateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function timeZoneOffsetMs(timestamp: number, timeZone: string): number {
  return asUtcMillis(partsInTimeZone(new Date(timestamp), timeZone)) - timestamp;
}

function parseLocalInput(value: string): DateTimeParts | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) return null;

  const parts: DateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  };
  const roundTrip = new Date(asUtcMillis(parts));
  if (
    roundTrip.getUTCFullYear() !== parts.year ||
    roundTrip.getUTCMonth() + 1 !== parts.month ||
    roundTrip.getUTCDate() !== parts.day ||
    roundTrip.getUTCHours() !== parts.hour ||
    roundTrip.getUTCMinutes() !== parts.minute ||
    roundTrip.getUTCSeconds() !== parts.second
  ) {
    return null;
  }
  return parts;
}

/**
 * Convert a stored ISO instant into the wall-clock value expected by an HTML
 * `datetime-local` input. The caller should normally omit `timeZone` so the
 * browser's current zone is used; tests pass an explicit IANA zone.
 */
export function isoToLocalDateTimeInput(
  value: string | null | undefined,
  timeZone = localTimeZone(),
): string {
  if (value === null || value === undefined || value.trim() === "") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("The stored expiry timestamp is not a valid ISO instant.");
  }
  const parts = partsInTimeZone(date, timeZone);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * Interpret an HTML `datetime-local` value in the requested wall-clock zone
 * and return an ISO UTC instant. Ambiguous fall-back times resolve to the
 * earlier occurrence; nonexistent spring-forward times are rejected.
 */
export function localDateTimeInputToIso(
  value: string | null | undefined,
  timeZone = localTimeZone(),
): string | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const parts = parseLocalInput(value);
  if (!parts) {
    throw new Error("The expiry timestamp is not a valid local date and time.");
  }

  const target = asUtcMillis(parts);
  const offsets = new Set<number>();
  for (const delta of [-12, 0, 12]) {
    offsets.add(timeZoneOffsetMs(target + delta * 60 * 60 * 1000, timeZone));
  }

  const candidates = [...offsets]
    .map((offset) => target - offset)
    .filter((candidate) => sameParts(partsInTimeZone(new Date(candidate), timeZone), parts))
    .sort((left, right) => left - right);

  if (candidates.length === 0) {
    throw new Error("This local time does not exist because of a daylight-saving transition.");
  }
  return new Date(candidates[0]).toISOString();
}

export type ExpirySaveResult =
  | { ok: true; expiresAt: string | null }
  | { ok: false; message: string };

/**
 * Resolve the form's expiry value for an update. When the input is unchanged
 * from the one loaded from the server, reuse the original instant exactly so
 * truncating seconds or an ambiguous DST wall-clock cannot shift the value.
 */
export function resolveExpiryForSave({
  input,
  originalInput,
  originalIso,
  now = new Date(),
  timeZone,
}: {
  input: string;
  originalInput?: string;
  originalIso?: string | null;
  now?: Date;
  timeZone?: string;
}): ExpirySaveResult {
  if (input.trim() === "") return { ok: true, expiresAt: null };

  let expiresAt: string | null;
  try {
    const unchanged =
      Boolean(originalInput) && Boolean(originalIso) && input === originalInput;
    expiresAt = unchanged
      ? (originalIso as string)
      : localDateTimeInputToIso(input, timeZone);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The expiry timestamp is invalid.",
    };
  }

  const instant = expiresAt ? new Date(expiresAt) : null;
  if (!instant || Number.isNaN(instant.getTime())) {
    return { ok: false, message: "The expiry timestamp is invalid." };
  }
  if (instant.getTime() <= now.getTime()) {
    return { ok: false, message: "Expiry time must be in the future." };
  }
  return { ok: true, expiresAt };
}

