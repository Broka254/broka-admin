// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InsightFeed } from "@/components/intelligence/insight-feed";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import { InsightsResponseSchema } from "@/lib/api/intelligence-schemas";
import { insightsFixture } from "./fixtures/intelligence";

const data = InsightsResponseSchema.parse(insightsFixture);

describe("InsightFeed", () => {
  it("shows every insight with its evidence and a link to act on it", () => {
    render(<InsightFeed data={data} isLoading={false} error={null} />);
    expect(screen.getAllByTestId(/^insight-/)).toHaveLength(4);
    const critical = screen.getByTestId("insight-complaints_sla");
    expect(within(critical).getByText("1 complaint past the first-reply deadline")).toBeInTheDocument();
    expect(within(critical).getByText("Act now")).toBeInTheDocument();
    expect(within(critical).getByText("30h")).toBeInTheDocument();
    expect(within(critical).getByRole("link", { name: /Answer complaints/ })).toHaveAttribute("href", "/complaints?queue=overdue");
    // An insight without an action has no link.
    expect(within(screen.getByTestId("insight-sellers_fast")).queryByRole("link")).toBeNull();
  });

  it("filters by severity using the backend's counts", () => {
    render(<InsightFeed data={data} isLoading={false} error={null} />);
    expect(screen.queryByRole("button", { name: /Context/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Opportunity · 1/ }));
    expect(screen.getAllByTestId(/^insight-/).map((card) => card.dataset.severity)).toEqual(["opportunity"]);
    fireEvent.click(screen.getByRole("button", { name: /All · 4/ }));
    expect(screen.getAllByTestId(/^insight-/)).toHaveLength(4);
  });

  it("caps a compact feed and links to the rest", () => {
    render(<InsightFeed data={data} isLoading={false} error={null} limit={2} />);
    expect(screen.getAllByTestId(/^insight-/)).toHaveLength(2);
    expect(screen.getByRole("link", { name: /2 more insights/ })).toHaveAttribute("href", "/intelligence#insights");
  });

  it("says plainly when nothing needs attention", () => {
    render(<InsightFeed data={{ ...data, insights: [], counts: {} }} isLoading={false} error={null} />);
    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
  });

  it("separates a backend that lacks the endpoint from a failure", () => {
    const { unmount } = render(<InsightFeed isLoading={false} error={new AdminRequestError("Not found", 404)} />);
    expect(screen.getByText(/need the upgraded BROKA API/)).toBeInTheDocument();
    unmount();
    render(<InsightFeed isLoading={false} error={new AdminRequestError("The BROKA API could not be reached.", 503)} onRetry={() => undefined} />);
    expect(screen.getByText("The BROKA API could not be reached.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });
});
