// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailComposer } from "@/components/email/email-composer";
import { AdminRequestError } from "@/hooks/use-admin-resource";
import type { AdminEmailSendOut } from "@/lib/api/email-schemas";

vi.mock("@/lib/api/email", () => ({ sendAdminEmail: vi.fn() }));

import { sendAdminEmail } from "@/lib/api/email";

const sendMock = vi.mocked(sendAdminEmail);

const sent: AdminEmailSendOut = {
  status: "sent",
  message_id: "re_msg_0001",
  sender: "Broka Admin <admin@broka.co.ke>",
  reply_to: "admin@broka.co.ke",
};

function renderComposer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<EmailComposer />, { wrapper: Wrapper });
}

function fill(values: { to?: string; subject?: string; message?: string } = {}) {
  fireEvent.change(screen.getByLabelText("To"), { target: { value: values.to ?? "wanjiru@example.com" } });
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: values.subject ?? "Re: your complaint" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: values.message ?? "Hello Wanjiru" } });
}

const form = () => screen.getByRole("form", { name: "Send an email" });

describe("EmailComposer", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("shows the fixed sender and where replies go, and offers no way to change them", () => {
    renderComposer();
    expect(screen.getByText("Broka Admin <admin@broka.co.ke>")).toBeInTheDocument();
    expect(screen.getByText("admin@broka.co.ke")).toBeInTheDocument();
    // The only fields are the recipient, the subject and the message: the
    // sender is shown as text, not offered as a control.
    const fields = Array.from(form().querySelectorAll("input, textarea, select")).map(
      (field) => (field as HTMLInputElement).labels?.[0]?.textContent,
    );
    expect(fields).toEqual(["To", "Subject", "Message"]);
    expect(screen.queryByLabelText(/from/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/reply.?to/i)).not.toBeInTheDocument();
  });

  it("says plainly that this is for sending only", () => {
    renderComposer();
    expect(screen.getByText(/does not show an inbox or the messages you have sent/i)).toBeInTheDocument();
  });

  it("explains each field that is wrong and sends nothing", async () => {
    renderComposer();
    fireEvent.submit(form());
    expect(await screen.findByText("Enter the recipient's email address")).toBeInTheDocument();
    expect(screen.getByText("Enter a subject")).toBeInTheDocument();
    expect(screen.getByText("Write a message")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toHaveAttribute("aria-invalid", "true");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("refuses an address that is not one plain address", async () => {
    renderComposer();
    fill({ to: "a@b.com, c@d.com" });
    fireEvent.submit(form());
    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends the trimmed fields with an idempotency key, shows progress, then confirms", async () => {
    let resolveSend!: (value: AdminEmailSendOut) => void;
    sendMock.mockReturnValue(new Promise((resolve) => { resolveSend = resolve; }));
    renderComposer();
    fill({ to: "  wanjiru@example.com ", subject: " Re: your complaint ", message: "  Hello Wanjiru  " });
    fireEvent.submit(form());

    const busy = await screen.findByRole("button", { name: /sending/i });
    expect(busy).toBeDisabled();
    expect(screen.getByLabelText("To")).toBeDisabled();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toEqual({ to: "wanjiru@example.com", subject: "Re: your complaint", message: "Hello Wanjiru" });
    expect(sendMock.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/);

    resolveSend(sent);
    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent("Message sent to wanjiru@example.com");
    expect(confirmation).toHaveTextContent("re_msg_0001");
    expect(confirmation).toHaveTextContent("Replies go to admin@broka.co.ke");
    expect(confirmation).toHaveTextContent(/does not show whether it reached the inbox/i);
  });

  it("starts the same request only once when submitted twice in the same moment", async () => {
    sendMock.mockReturnValue(new Promise(() => undefined));
    renderComposer();
    fill();
    fireEvent.submit(form());
    fireEvent.submit(form());
    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1));
  });

  it("clears the form after a send so the next message starts empty", async () => {
    sendMock.mockResolvedValue(sent);
    renderComposer();
    fill();
    fireEvent.submit(form());
    fireEvent.click(await screen.findByRole("button", { name: /write another/i }));
    expect(screen.getByLabelText("To")).toHaveValue("");
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("keeps what was typed and shows the server's own words when the send is refused", async () => {
    sendMock.mockRejectedValue(new AdminRequestError(
      "The email provider rejected this message. Check the recipient address and try again.", 422, "email_rejected",
    ));
    renderComposer();
    fill();
    fireEvent.submit(form());
    expect(await screen.findByRole("alert")).toHaveTextContent("The email provider rejected this message.");
    expect(screen.getByLabelText("To")).toHaveValue("wanjiru@example.com");
    expect(screen.getByLabelText("Message")).toHaveValue("Hello Wanjiru");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send email/i })).toBeEnabled();
  });

  it("does not claim a send that may not have happened, and says retrying is safe", async () => {
    sendMock.mockRejectedValue(new AdminRequestError(
      "The email provider is unavailable or did not respond, so this message may not have been sent. Retrying is safe: the same request is never sent twice.",
      502, "email_provider_unavailable",
    ));
    renderComposer();
    fill();
    fireEvent.submit(form());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/may not have been sent/i);
    expect(alert).toHaveTextContent(/Your message is kept/i);
    expect(screen.queryByText(/message sent to/i)).not.toBeInTheDocument();
  });

  describe("the idempotency key", () => {
    async function submitAndSettle(expectedCalls: number) {
      fireEvent.submit(form());
      await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(expectedCalls));
      await screen.findByRole("alert");
    }

    it.each([
      ["no answer at all", new AdminRequestError("The dashboard could not reach the server.", 0, "network")],
      ["a provider outage", new AdminRequestError("unavailable", 502, "email_provider_unavailable")],
      ["a request still in flight", new AdminRequestError("in use", 409, "email_duplicate_request")],
      ["a server error", new AdminRequestError("The BROKA API is temporarily unavailable.", 503, "upstream_error")],
    ])("is reused for the same message after %s, so a retry cannot become a second email", async (_label, error) => {
      sendMock.mockRejectedValue(error);
      renderComposer();
      fill();
      await submitAndSettle(1);
      fireEvent.submit(form());
      await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(2));
      expect(sendMock.mock.calls[1][1]).toBe(sendMock.mock.calls[0][1]);
    });

    it.each([
      ["a rejected address", new AdminRequestError("rejected", 422, "email_rejected")],
      ["the provider's limit", new AdminRequestError("limit", 429, "email_provider_limit")],
      ["a missing permission", new AdminRequestError("Missing permission", 403, "forbidden")],
    ])("is replaced after %s, because nothing was sent", async (_label, error) => {
      sendMock.mockRejectedValue(error);
      renderComposer();
      fill();
      await submitAndSettle(1);
      fireEvent.submit(form());
      await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(2));
      expect(sendMock.mock.calls[1][1]).not.toBe(sendMock.mock.calls[0][1]);
    });

    it("is replaced when the message is changed, even after a failure that may have sent it", async () => {
      sendMock.mockRejectedValue(new AdminRequestError("unavailable", 502, "email_provider_unavailable"));
      renderComposer();
      fill();
      await submitAndSettle(1);
      fireEvent.change(screen.getByLabelText("Message"), { target: { value: "A different message" } });
      fireEvent.submit(form());
      await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(2));
      expect(sendMock.mock.calls[1][1]).not.toBe(sendMock.mock.calls[0][1]);
    });

    it("is new for the next message after a successful send", async () => {
      sendMock.mockResolvedValue(sent);
      renderComposer();
      fill();
      fireEvent.submit(form());
      fireEvent.click(await screen.findByRole("button", { name: /write another/i }));
      fill();
      fireEvent.submit(form());
      await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(2));
      expect(sendMock.mock.calls[1][1]).not.toBe(sendMock.mock.calls[0][1]);
    });
  });
});
