import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PR Summarizer | AI Code Review Workspace",
  description:
    "Analyze diffs and code snippets with structured AI code review output and concise PR summaries.",
};

// The root layout stays minimal because the visual system now lives in CSS and builds offline.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
