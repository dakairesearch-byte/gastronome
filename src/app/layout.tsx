import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Gastronome — Every Restaurant Rating in One Place",
  description: "Compare Google, Yelp, The Infatuation, and Michelin ratings side by side. Like Rotten Tomatoes, but for food.",
  keywords: "restaurant ratings, restaurant reviews, Google rating, Yelp rating, Michelin stars, Infatuation, dining, food",
  authors: [{ name: "Gastronome" }],
  openGraph: {
    title: "Gastronome — Every Restaurant Rating in One Place",
    description: "Compare Google, Yelp, The Infatuation, and Michelin ratings side by side. Like Rotten Tomatoes, but for food.",
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
