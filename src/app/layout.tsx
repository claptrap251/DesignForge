import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

const authBasePath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth`;

export const metadata: Metadata = {
  title: "DesignForge - Design Review Platform",
  description: "Upload designs, collect pin-based feedback, and export review reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-900 font-sans">
        <SessionProvider basePath={authBasePath}>
          <ThemeProvider>{children}</ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
