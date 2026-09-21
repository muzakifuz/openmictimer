import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({
  subsets: ["latin"],
  variable: "--font-onest",
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
    <html lang="en" className={onest.variable}>
      <body className="bg-base text-white font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
