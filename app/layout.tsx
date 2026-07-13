import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reading Record",
  description: "A personal archive for reading, watching, playing, and writing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
