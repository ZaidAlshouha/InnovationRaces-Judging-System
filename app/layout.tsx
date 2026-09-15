import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-sans",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "نظام إدارة وتحكيم الهاكاثونات | InnovationRaces",
  description:
    "منصة InnovationRaces لإدارة تحكيم الهاكاثونات: توزيع المحكمين، جمع التقييمات، احتساب النتائج المرجّحة، ومتابعة الإنجاز والترتيب النهائي.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${ibmPlexSansArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
