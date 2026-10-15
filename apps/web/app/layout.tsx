import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print Kiosk",
  description: "Phone-to-printer in under 2 minutes (see docs/PRD.md)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
