import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { JarrettWidget } from "@/components/jarrett-widget";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MarketBuzz -- Multi-Agent Market Reaction Simulator",
  description:
    "Simulate how primary dealers react to market events through multi-round AI agent roundtables. Watch consensus form, dissent emerge, and crises shift positions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${firaSans.variable} ${firaCode.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        <ThemeProvider>
          {children}
          <JarrettWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
