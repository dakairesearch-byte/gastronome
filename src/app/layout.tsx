import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Gastronome — Food Reviews by Real People",
  description: "Discover restaurants through authentic reviews from passionate food critics. Write reviews, follow critics, and find your next favorite restaurant.",
  keywords: "food reviews, restaurants, dining, food critic, restaurant ratings, food photography",
  authors: [{ name: "Gastronome" }],
  openGraph: {
    title: "Gastronome — Food Reviews by Real People",
    description: "Discover restaurants through authentic reviews from passionate food critics. Write reviews, follow critics, and find your next favorite restaurant.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased scroll-smooth">
      <body style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }} className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
