import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "TickerPro — WhatsApp Business API Platform",
  description:
    "The most intelligent, scalable WhatsApp growth platform. AI conversation intelligence, multi-number governance, and full-funnel revenue attribution.",
  keywords: [
    "WhatsApp Business API",
    "WhatsApp CRM",
    "WhatsApp Marketing",
    "Business Messaging",
    "TickerPro",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
