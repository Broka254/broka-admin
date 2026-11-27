import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZenoCommandBar } from "@/components/jarvis/core/command-bar";
import { JarvisProvider } from "@/components/jarvis/provider";
import { IntelligenceCoreView } from "@/components/jarvis/views/intelligence-core";

import { statusFixture } from "./fixtures/jarvis";
import { commandCentreFixture, installProxy, renderWithClient, type FakeProxy } from "./fixtures/jarvis-proxy";

vi.mock("next/navigation", () => ({
  usePathname: () => "/assistant/core",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

let proxy: FakeProxy;

function renderCore() {
  return renderWithClient(
    <JarvisProvider>
      <ZenoCommandBar />
      <IntelligenceCoreView />
    </JarvisProvider>,
  );
}

beforeEach(() => {
  proxy = installProxy();
  proxy.resources.set("admin/command-center", { status: 200, body: commandCentreFixture() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("intelligence core", () => {
  it("lists readiness as names and counts, never as keys or provider messages", async () => {
    renderCore();
    expect(await screen.findByText("gemini, groq")).toBeInTheDocument();
    expect(screen.getByText("Ready · 14 tools")).toBeInTheDocument();
    expect(screen.getByText("None recorded")).toBeInTheDocument();
  });

  it("fills the command bar from a suggested investigation without sending it", async () => {
    renderCore();
    const suggestion = await screen.findByRole("button", { name: "Which operational figures are outside their normal range?" });
    fireEvent.click(suggestion);
    expect(screen.getByLabelText("Ask Zeno")).toHaveValue("Which operational figures are outside their normal range?");
    expect(proxy.callsTo("POST", "admin/zeno/chat")).toHaveLength(0);
  });

  it("states that Zeno is not enabled, and makes no investigation request", async () => {
    proxy.status = { status: 503, body: { code: "ADMIN_ZENO_DISABLED", message: "x", request_id: "r" } };
    renderCore();
    expect((await screen.findAllByText("Jarvis Mode is not enabled")).length).toBeGreaterThan(0);
    expect(proxy.callsTo("GET", "admin/zeno/conversations")).toHaveLength(0);
  });

  it("shows how many investigations are saved, once the list has loaded", async () => {
    proxy.seedConversation();
    renderCore();
    const saved = screen.getByRole("region", { name: "Saved investigations" });
    expect(await within(saved).findByText("1")).toBeInTheDocument();
  });

  it("says when the model gateway is not ready and that briefings still work", async () => {
    proxy.status = { status: 200, body: statusFixture({ model_gateway_ready: false, providers_configured: [] }) };
    renderCore();
    expect(
      await screen.findByText("The model gateway is not ready. Briefings and the figures on every page still work."),
    ).toBeInTheDocument();
    expect(screen.getByText("None configured")).toBeInTheDocument();
  });
});
