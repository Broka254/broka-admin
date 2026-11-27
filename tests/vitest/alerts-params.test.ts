import { describe, expect, it } from "vitest";

import { buildAlertListParams } from "@/hooks/use-alerts";

describe("alert list query", () => {
  it("sends status=all so the backend returns every status, not its default of open alerts", () => {
    const params = buildAlertListParams({ status: "all", limit: 50 });
    expect(params.get("status")).toBe("all");
    expect(params.get("limit")).toBe("50");
  });

  it("omits severity when it is all, because no severity filter means every severity", () => {
    const params = buildAlertListParams({ status: "open", severity: "all" });
    expect(params.get("status")).toBe("open");
    expect(params.has("severity")).toBe(false);
  });

  it("passes a specific severity through", () => {
    expect(buildAlertListParams({ severity: "critical" }).get("severity")).toBe("critical");
  });
});
