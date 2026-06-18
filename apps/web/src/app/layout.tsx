import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "trivia.live",
  description: "Live trivia. Virtual points. No cash.",
  manifest: "/manifest.json",
  themeColor: "#7c3aed",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "trivia.live",
  },
};

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
