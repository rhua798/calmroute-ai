import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalmRoute AI | Proactive Travel Assistant",
  description: "A proactive AI travel assistant designed for smart cockpits.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
