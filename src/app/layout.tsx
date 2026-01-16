import type { Metadata, Viewport } from "next";
import { Outfit, Syne } from "next/font/google";
import { ConvexClientProvider } from "@/lib/convex";
import { AuthProvider } from "@/lib/auth-context";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CarpTrack",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={`${outfit.variable} ${syne.variable} antialiased`}>
        <ServiceWorkerRegister />
        <ConvexClientProvider>
          <AuthProvider>{children}</AuthProvider>
        </ConvexClientProvider>
        <div className="noise-overlay" aria-hidden="true" />
      </body>
    </html>
  );
}
