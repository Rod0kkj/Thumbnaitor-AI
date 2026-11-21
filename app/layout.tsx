import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thumbnatior AI — Thumbnail Studio",
  description: "Create and refine video thumbnails with AI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
