import "server-only";

export const ACCESS_COOKIE = "broka_admin_access";
export const REFRESH_COOKIE = "broka_admin_refresh";

export class BrokaApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code:
      | "not-configured"
      | "network"
      | "unauthorized"
      | "forbidden"
      | "upstream"
      | "invalid-response" = "upstream",
  ) {
    super(message);
    this.name = "BrokaApiError";
  }
}

function apiBaseUrl() {
  const value = process.env.BROKA_API_URL?.trim();
  if (!value) {
    throw new BrokaApiError(
      "The BROKA API URL has not been configured for this deployment.",
      undefined,
      "not-configured",
    );
  }

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new BrokaApiError(
      "The configured BROKA API URL is invalid.",
      undefined,
      "not-configured",
    );
  }
}

function apiTimeout() {
  const configured = Number(process.env.BROKA_API_TIMEOUT ?? "10000");
  return Number.isFinite(configured) && configured > 0 ? configured : 10000;
}

export function isApiConfigured() {
  return Boolean(process.env.BROKA_API_URL?.trim());
}

export async function upstreamFetch(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  try {
    return await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(apiTimeout()),
    });
  } catch (error) {
    if (error instanceof BrokaApiError) throw error;
    throw new BrokaApiError(
      "The BROKA API could not be reached. Please retry shortly.",
      undefined,
      "network",
    );
  }
}

export async function parseUnknownJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new BrokaApiError(
      "The BROKA API returned a response that could not be read safely.",
      response.status,
      "invalid-response",
    );
  }
}

export function publicErrorMessage(response: Response) {
  if (response.status === 401) return "Your session is no longer valid. Please sign in again.";
  if (response.status === 403) return "Your BROKA account is not authorized for this action.";
  if (response.status >= 500) return "The BROKA API is temporarily unavailable. Please retry shortly.";
  return "The BROKA API could not complete this request.";
}
