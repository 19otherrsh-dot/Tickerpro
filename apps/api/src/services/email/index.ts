/**
 * Pluggable transactional email.
 *
 * Drivers are selected via EMAIL_PROVIDER:
 *   - "console" (default)  — logs the email; ideal for local dev / tests
 *   - "resend"             — Resend HTTP API (needs RESEND_API_KEY)
 *   - "sendgrid"           — SendGrid HTTP API (needs SENDGRID_API_KEY)
 *
 * All drivers use fetch (no SDK dependency). EMAIL_FROM sets the sender.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<{ success: boolean; id?: string; error?: string }>;
}

const FROM = process.env.EMAIL_FROM || "TickerPro <no-reply@tickerpro.local>";

class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(msg: EmailMessage) {
    console.log(
      `[Email:console] To: ${msg.to} | From: ${FROM} | Subject: ${msg.subject}\n${msg.text ?? msg.html}`
    );
    return { success: true, id: `console_${Date.now()}` };
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  async send(msg: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) return { success: false, error: `Resend ${res.status}: ${await res.text()}` };
    const data = (await res.json()) as { id?: string };
    return { success: true, id: data.id };
  }
}

class SendGridEmailProvider implements EmailProvider {
  readonly name = "sendgrid";
  async send(msg: EmailMessage) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: msg.to }] }],
        from: { email: FROM },
        subject: msg.subject,
        content: [
          { type: "text/plain", value: msg.text ?? "" },
          { type: "text/html", value: msg.html },
        ],
      }),
    });
    if (!res.ok) return { success: false, error: `SendGrid ${res.status}: ${await res.text()}` };
    return { success: true, id: res.headers.get("x-message-id") ?? undefined };
  }
}

let _provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (_provider) return _provider;
  switch ((process.env.EMAIL_PROVIDER || "console").toLowerCase()) {
    case "resend":
      _provider = new ResendEmailProvider();
      break;
    case "sendgrid":
      _provider = new SendGridEmailProvider();
      break;
    default:
      _provider = new ConsoleEmailProvider();
  }
  return _provider;
}

export function sendEmail(msg: EmailMessage) {
  return getEmailProvider().send(msg);
}

/** Build + send a password-reset email. */
export function sendPasswordResetEmail(to: string, rawToken: string) {
  const base = process.env.APP_URL || "http://localhost:3000";
  const link = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
  return sendEmail({
    to,
    subject: "Reset your TickerPro password",
    text: `Reset your password using this link (valid for 1 hour): ${link}`,
    html: `<p>We received a request to reset your TickerPro password.</p>
<p><a href="${link}">Click here to reset it</a> — this link is valid for 1 hour.</p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}
