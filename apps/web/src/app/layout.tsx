import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MatOS",
  description: "Company operating layer — Citron Volt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full bg-matos-bg text-matos-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
