import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  const w = window as unknown as Record<string, unknown>;
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    w.ResizeObserver = ResizeObserverStub;
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

const navigation = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams() }));

vi.mock("@/lib/csv", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/csv")>();
  return { ...actual, downloadCSV: vi.fn() };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/reports/builder",
  useSearchParams: () => navigation.params,
}));
vi.mock("@/hooks/use-admin-resource", () => ({
  AdminRequestError: class AdminRequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  isEndpointMissing: (error: unknown) => (error as { status?: number } | null)?.status === 404,
  useAdminResource: vi.fn(),
  useAdminDetail: vi.fn(),
}));
vi.mock("@/hooks/use-report-builder", () => ({
  usePreviewReport: vi.fn(), useCreateRun: vi.fn(), useRegenerateRun: vi.fn(), useRunDefinition: vi.fn(),
  useSaveDefinition: vi.fn(), useUpdateDefinition: vi.fn(), useDeleteDefinition: vi.fn(),
}));

import { BuilderReportView } from "@/components/reports/builder-report";
import { ReportBuilder } from "@/components/reports/report-builder";
import { useAdminDetail, useAdminResource } from "@/hooks/use-admin-resource";
import * as builderHooks from "@/hooks/use-report-builder";
import { isSafeAdminPath, resourceForPath } from "@/lib/api/admin";
import {
  BuilderPayloadSchema, CatalogSchema, DefinitionPatchSchema, DefinitionSchema, RunDetailSchema, SpecInSchema,
} from "@/lib/api/report-builder-schemas";
import { parseAdminResource } from "@/lib/api/schemas";
import { downloadCSV, toCSV } from "@/lib/csv";
import {
  changeText, defaultForm, formError, formToSpec, formatBuilderValue, payloadCsvRows, reportFileStem, scheduleText,
  specToForm,
} from "@/lib/report-builder";
import {
  catalogFixture, definitionFixture, payloadFixture, runDetailFixture, runMetaFixture,
} from "./fixtures/report-builder";

const NOW = Date.parse("2025-03-20T09:00:00Z");
const payload = BuilderPayloadSchema.parse(payloadFixture);

describe("report builder contracts", () => {
  it("validates a payload, a stored run, the catalog and a saved report", () => {
    expect(payload.kpis.find((k) => k.key === "active_users")?.available).toBe(false);
    expect(parseAdminResource("reportBuilderRunDetail", runDetailFixture).payload?.title).toBe("Weekly business review");
    expect(RunDetailSchema.parse({ ...runMetaFixture, status: "failed", error: "RuntimeError", spec: {}, payload: null }).payload).toBeNull();
    expect(CatalogSchema.parse(catalogFixture).email.recipients[0].email_hint).toBe("a…@broka.co.ke");
    expect(DefinitionSchema.parse(definitionFixture).schedule).toBe("weekly");
  });

  it("allowlists the builder's reads and keeps the PDF to its own route", () => {
    for (const path of ["admin/report-builder/catalog", "admin/report-builder/runs", "admin/report-builder/definitions",
      "admin/report-builder/runs/run-1", "admin/operations"]) {
      expect(isSafeAdminPath(path), path).toBe(true);
    }
    expect(resourceForPath("/admin/report-builder/runs/run-1")).toBe("reportBuilderRunDetail");
    expect(isSafeAdminPath("admin/report-builder/runs/run-1/pdf")).toBe(false);
    expect(isSafeAdminPath("admin/report-builder/runs/..")).toBe(false);
  });

  it("refuses request fields the backend does not name", () => {
    expect(SpecInSchema.safeParse({ title: "x", sql: "drop" }).success).toBe(false);
    expect(SpecInSchema.safeParse({ title: "x", date_from: "1 March" }).success).toBe(false);
    expect(DefinitionPatchSchema.safeParse({ enabled: false }).success).toBe(false);
    expect(DefinitionPatchSchema.safeParse({ expected_version: 2, enabled: false }).success).toBe(true);
  });
});

describe("form rules", () => {
  it("accepts the default form and sends the last 7 days", () => {
    const form = defaultForm(NOW);
    expect(formError(form, 366, NOW)).toBeNull();
    expect(formToSpec(form)).toMatchObject({ categories: ["business"], last_days: 7, date_from: null, date_to: null,
      filters: { category: null, county: null }, comparison: "previous_period" });
  });

  it("explains a bad form", () => {
    const form = defaultForm(NOW);
    expect(formError({ ...form, title: " " }, 366, NOW)).toBe("Give the report a title.");
    expect(formError({ ...form, categories: [] }, 366, NOW)).toBe("Choose at least one category or figure.");
    expect(formError({ ...form, lastDays: 400 }, 366, NOW)).toBe("The last 1 to 366 days.");
    const fixed = { ...form, rangeMode: "fixed" as const };
    expect(formError({ ...fixed, dateFrom: "2025-03-07", dateTo: "2025-03-01" }, 366, NOW)).toBe("The end date is before the start date.");
    expect(formError({ ...fixed, dateFrom: "2024-01-01", dateTo: "2025-03-07" }, 366, NOW)).toBe("A report covers at most 366 days; this one is 432.");
    expect(formError({ ...fixed, dateFrom: "2025-04-01", dateTo: "2025-04-02" }, 366, NOW)).toBe("The start date is in the future.");
    expect(formToSpec({ ...fixed, dateFrom: "2025-03-01", dateTo: "2025-03-07", category: "Electronics" })).toMatchObject({
      date_from: "2025-03-01", date_to: "2025-03-07", last_days: null, filters: { category: "Electronics", county: null } });
  });

  it("loads a saved spec back, keeping the figures chosen one by one", () => {
    const form = specToForm(DefinitionSchema.parse(definitionFixture).spec, { growth: ["new_users", "new_listings"] }, NOW);
    expect(form.rangeMode).toBe("last");
    expect(form.categories).toEqual(["growth"]);
    expect(form.metrics).toEqual(["income_minor", "active_users"]);
  });
});

describe("values and exports", () => {
  it("formats each unit and never prints a missing value as zero", () => {
    expect(formatBuilderValue(1234, "count")).toBe("1,234");
    expect(formatBuilderValue(52.5, "pct")).toBe("52.5%");
    expect(formatBuilderValue(1_250_000, "kes_minor")).toBe("KES 12,500");
    expect(formatBuilderValue(12, "minutes")).toBe("12 min");
    expect(formatBuilderValue(420.4, "ms")).toBe("420 ms");
    expect(formatBuilderValue(null, "count")).toBe("—");
    expect(changeText({ unit: "pct", delta: 7, change_pct: null, previous: 45 })).toBe("+7.0 pts");
    expect(changeText({ unit: "count", delta: -20, change_pct: -40, previous: 50 })).toBe("−40%");
    expect(changeText({ unit: "count", delta: null, change_pct: null, previous: null })).toBeNull();
  });

  it("exports every figure, chart point and table cell, with shillings and no invented zeros", () => {
    const rows = payloadCsvRows(payload);
    const income = rows.find((r) => r.part === "figure" && r.item === "Income");
    expect(income).toMatchObject({ value: 12500, previous: 10000, unit: "KES", measured: "yes", period: "2025-03-01 to 2025-03-07 UTC" });
    const active = rows.find((r) => r.part === "figure" && r.item === "Active users");
    expect(active).toMatchObject({ value: null, measured: "no", note: "Activity tracking had not started." });
    const gap = rows.find((r) => r.part === "series" && r.period === "2025-03-02");
    expect(gap).toMatchObject({ value: null, measured: "no" });
    const cell = rows.find((r) => r.part === "table" && r.column === "Income");
    expect(cell).toMatchObject({ item: "Listing fees", value: 9000, unit: "KES" });
    const csv = toCSV(rows);
    const header = csv.split("\n")[0].split(",");
    const activeLine = csv.split("\n").find((line) => line.includes("Active users"))!.split(",");
    expect(activeLine[header.indexOf("value")]).toBe("");
  });

  it("names files and schedules plainly", () => {
    expect(reportFileStem("Weekly / business review!", "2025-03-01T00:00:00Z")).toBe("broka-weekly-business-review-2025-03-01");
    const d = DefinitionSchema.parse(definitionFixture);
    expect(scheduleText(d)).toBe("Every Monday at 05:00 UTC, for the 7 days before");
    expect(scheduleText({ ...d, schedule: "daily", schedule_hour_utc: 4 })).toBe("Daily at 04:00 UTC, for the day before");
    expect(scheduleText({ ...d, schedule: "monthly", schedule_day: 1 })).toBe("On day 1 of each month at 05:00 UTC, for the month before");
    expect(scheduleText({ ...d, schedule: "custom", schedule_every_days: 3 })).toBe("Every 3 days at 05:00 UTC, for the days since");
    expect(scheduleText({ ...d, schedule: "none" })).toBe("Not scheduled");
  });
});

describe("BuilderReportView", () => {
  it("shows what was measured, what was not and why, and what to do", () => {
    render(<BuilderReportView payload={payload} runId="run-1" stored />);
    const active = screen.getByTestId("kpi-active_users");
    expect(within(active).getByText("Not measured")).toBeInTheDocument();
    expect(within(active).getByText("Activity tracking had not started.")).toBeInTheDocument();
    expect(within(screen.getByTestId("kpi-income_minor")).getByText("KES 12,500")).toBeInTheDocument();
    expect(within(screen.getByTestId("kpi-liquidity_pct")).getByText("+7.0 pts")).toBeInTheDocument();
    expect(screen.getByText("New users fell 40% against the period before: 50 to 30.")).toBeInTheDocument();
    expect(screen.getByText("Based on New users (users.created_at).")).toBeInTheDocument();
    expect(screen.getByText(/New registrations on 2025-03-05/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PDF" })).toHaveAttribute("href", "/api/broka/report-builder/runs/run-1/pdf");
  });

  it("offers a PDF only once the report is stored", () => {
    render(<BuilderReportView payload={payload} stored={false} />);
    expect(screen.queryByRole("link", { name: "PDF" })).toBeNull();
    expect(screen.getByRole("button", { name: "PDF after saving" })).toBeDisabled();
    expect(screen.getByText("Preview · not stored")).toBeInTheDocument();
  });

  it("exports the CSV of exactly what is shown", () => {
    render(<BuilderReportView payload={payload} runId="run-1" stored />);
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    const [filename, rows] = vi.mocked(downloadCSV).mock.calls[0];
    expect(filename).toBe("broka-weekly-business-review-2025-03-01.csv");
    expect(rows).toEqual(payloadCsvRows(payload));
  });
});

function mutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, error: null, data: undefined, ...overrides };
}

function ok(data: unknown) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() };
}

describe("ReportBuilder", () => {
  const hooks = {} as Record<string, ReturnType<typeof mutation>>;

  beforeEach(() => {
    navigation.params = new URLSearchParams();
    for (const name of ["usePreviewReport", "useCreateRun", "useRegenerateRun", "useRunDefinition", "useSaveDefinition",
      "useUpdateDefinition", "useDeleteDefinition"] as const) {
      hooks[name] = mutation();
      vi.mocked(builderHooks[name]).mockReturnValue(hooks[name] as never);
    }
    vi.mocked(useAdminResource).mockImplementation(((resource: string) => {
      if (resource === "reportBuilderCatalog") return ok(CatalogSchema.parse(catalogFixture));
      if (resource === "reportBuilderRuns") return ok({ items: [runMetaFixture], total: 1, limit: 20, offset: 0, generated_at: "2025-03-20T09:00:00Z" });
      if (resource === "reportBuilderDefinitions") return ok({ items: [DefinitionSchema.parse(definitionFixture)], total: 1, generated_at: "2025-03-20T09:00:00Z" });
      return ok(undefined);
    }) as never);
    vi.mocked(useAdminDetail).mockReturnValue(ok(undefined) as never);
  });

  it("previews the spec the form describes", () => {
    render(<ReportBuilder />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    const spec = hooks.usePreviewReport.mutate.mock.calls[0][0];
    expect(spec).toMatchObject({ title: "Weekly business review", categories: ["business"], last_days: 7, comparison: "previous_period" });
  });

  it("saves a weekly schedule emailed to a chosen administrator", () => {
    render(<ReportBuilder />);
    fireEvent.click(screen.getByRole("button", { name: "Save…" }));
    fireEvent.change(screen.getByLabelText("Schedule"), { target: { value: "weekly" } });
    fireEvent.change(screen.getByLabelText("Weekday"), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText(/Amina/));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const body = hooks.useSaveDefinition.mutate.mock.calls[0][0];
    expect(body).toMatchObject({ schedule: "weekly", schedule_weekday: 2, schedule_day: null, recipients: ["admin-1"], enabled: true });
    expect(body.spec).toMatchObject({ categories: ["business"] });
  });

  it("lists saved reports with their schedule and pauses one with the version it read", () => {
    render(<ReportBuilder />);
    expect(screen.getByText("Every Monday at 05:00 UTC, for the 7 days before")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(hooks.useUpdateDefinition.mutate.mock.calls[0][0]).toEqual({ id: "def-1", patch: { expected_version: 1, enabled: false } });
  });

  it("opens an archived report from the URL", () => {
    navigation.params = new URLSearchParams("run=run-1");
    vi.mocked(useAdminDetail).mockReturnValue(ok(RunDetailSchema.parse(runDetailFixture)) as never);
    render(<ReportBuilder />);
    expect(useAdminDetail).toHaveBeenCalledWith("reportBuilderRunDetail", "run-1", true);
    expect(screen.getByRole("heading", { name: "Weekly business review" })).toBeInTheDocument();
    expect(screen.getByText("Stored")).toBeInTheDocument();
  });

  it("says when the API has no report builder yet", () => {
    vi.mocked(useAdminResource).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { status: 404 }, refetch: vi.fn() } as never);
    render(<ReportBuilder />);
    expect(screen.getByText("The report builder needs the upgraded BROKA API.")).toBeInTheDocument();
  });
});
