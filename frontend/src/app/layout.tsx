import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrapp",
  description: "Your personal legacy engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=cabinet-grotesk@700,800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-white text-black font-satoshi antialiased">
        {children}
      </body>
    </html>
  );
}
