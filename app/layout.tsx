import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Openmic Timer",
  description: "Keep the laughs on time. Manage your lineup, track laughs, and stay on top of every comic's set.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-base text-white font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
