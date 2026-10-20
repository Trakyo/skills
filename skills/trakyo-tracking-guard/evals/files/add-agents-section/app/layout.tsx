import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Acme Coaching" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://go.acme-coaching.com/api/js/latest.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
