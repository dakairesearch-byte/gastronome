import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Gastronome - Food Reviews by Passionate Critics",
  description: "Discover authentic food reviews from passionate home critics. Rate restaurants, share your dining experiences, and follow fellow food enthusiasts on Gastronome.",
  keywords: "food reviews, restaurants, dining, food critic, restaurant ratings, food photography",
  authors: [{ name: "Gastronome" }],
  openGraph: {
    title: "Gastronome - Food Reviews by Passionate Critics",
    description: "Discover authentic food reviews from passionate home critics.",
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
      <body style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }} className="min-h-screen flex flex-col bg-[#FAFAF8]">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
