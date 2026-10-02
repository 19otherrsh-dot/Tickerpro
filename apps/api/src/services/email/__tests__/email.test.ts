import { describe, it, expect, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

// Re-import fresh each test so the provider singleton + env are re-evaluated.
async function freshEmailModule() {
  vi.resetModules();
  return import("../index.js");
}

describe("email provider factory", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("defaults to the console provider", async () => {
    delete process.env.EMAIL_PROVIDER;
    const { getEmailProvider } = await freshEmailModule();
    expect(getEmailProvider().name).toBe("console");
  });

  it("selects resend / sendgrid by env", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    expect((await freshEmailModule()).getEmailProvider().name).toBe("resend");
    process.env.EMAIL_PROVIDER = "sendgrid";
    expect((await freshEmailModule()).getEmailProvider().name).toBe("sendgrid");
  });

  it("console provider 'sends' successfully without network", async () => {
    process.env.EMAIL_PROVIDER = "console";
    const { sendEmail } = await freshEmailModule();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(res.success).toBe(true);
    expect(logSpy).toHaveBeenCalled();
  });

  it("password reset email builds a link with the token", async () => {
    process.env.EMAIL_PROVIDER = "console";
    process.env.APP_URL = "https://app.example.com";
    const mod = await freshEmailModule();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await mod.sendPasswordResetEmail("user@example.com", "tok123");
    expect(res.success).toBe(true);
    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("https://app.example.com/reset-password?token=tok123");
  });
});
