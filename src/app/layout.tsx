import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DhanSathi - Your Financial Companion",
  description: "AI-Powered Hyper-Personalized Banking for Bharat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} font-sans h-full antialiased bg-gray-950 text-gray-100`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
