import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { PrivyProvider } from "@/providers/PrivyProvider";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Universal Checkout — Tempo",
  description:
    "Gasless stablecoin checkout links with auto FX. Pay with any stablecoin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body className={`${geistMono.variable} antialiased`}>
        <PrivyProvider>{children}</PrivyProvider>
      </body>
    </html>
  );
}
