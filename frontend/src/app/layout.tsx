import type { Metadata } from "next";
import localFont from "next/font/local";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { QueryProvider } from "@/providers/QueryProvider";
import "./globals.css";

const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
});

const cabinetGrotesk = localFont({
  src: [
    { path: "./fonts/CabinetGrotesk-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/CabinetGrotesk-Extrabold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-cabinet",
});

export const metadata: Metadata = {
  title: "Edition",
  description: "Your personal legacy engine",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Edition",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${satoshi.variable} ${cabinetGrotesk.variable} h-full`}>
      <head>
        <meta name="theme-color" content="#223843" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full bg-bg text-text font-[family-name:var(--font-satoshi)] antialiased">
        <ServiceWorkerRegistrar />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
