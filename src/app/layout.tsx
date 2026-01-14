import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { ConvexClientProvider } from "@/lib/convex";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CarpTrack | Carpentry Business Management",
  description:
    "Streamline your carpentry business with job tracking, timesheets, and real-time profitability insights.",
  keywords: [
    "carpentry",
    "business management",
    "job tracking",
    "timesheets",
    "construction",
  ],
  authors: [{ name: "Ryox Carpentry" }],
  openGraph: {
    title: "CarpTrack | Carpentry Business Management",
    description:
      "Streamline your carpentry business with job tracking, timesheets, and real-time profitability insights.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} ${syne.variable} antialiased`}>
        <ConvexClientProvider>
          <AuthProvider>{children}</AuthProvider>
        </ConvexClientProvider>
        <div className="noise-overlay" aria-hidden="true" />
      </body>
    </html>
  );
}
