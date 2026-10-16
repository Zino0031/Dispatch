import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Print kiosk",
  description: "Send a document to a campus print kiosk.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}