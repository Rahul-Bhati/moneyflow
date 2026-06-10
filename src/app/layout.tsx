import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "MoneyFlow — daily money tracker",
  description:
    "A calm, fast way to track what you spend and earn — by day, week, month and year.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MoneyFlow" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f0e9" },
    { media: "(prefers-color-scheme: dark)", color: "#100f0c" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full antialiased">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "var(--accent)",
              colorBackground: "var(--surface)",
              colorText: "var(--ink)",
              colorTextSecondary: "var(--muted)",
              colorInputBackground: "var(--surface-2)",
              colorInputText: "var(--ink)",
              borderRadius: "var(--radius-xl)",
              fontFamily: "var(--font-display)",
            },
            elements: {
              card: "shadow-none border border-border",
            },
          }}
        >
          <ThemeProvider>{children}</ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
