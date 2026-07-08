import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prospex — Open-source AI GTM Automation",
  description:
    "Self-hosted platform to find leads, generate personalized AI outreach, and close deals. Open-source alternative to Apollo.io and Instantly.ai.",
  keywords: ["lead generation", "AI outreach", "open source", "self-hosted", "GTM automation"],
  openGraph: {
    title: "Prospex — Open-source AI GTM Automation",
    description:
      "Find leads, generate personalized outreach, and close deals — all powered by AI. Free, open-source, self-hosted.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          value={{ dark: "dark", light: "light" }}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
