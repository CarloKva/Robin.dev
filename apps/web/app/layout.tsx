import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Robin.dev",
  description: "AI-powered development task management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      afterSignInUrl="/backlog"
      afterSignUpUrl="/onboarding/workspace"
    >
      <html lang="en" className={inter.variable}>
        <body className="font-sans">{children}</body>
      </html>
    </ClerkProvider>
  );
}
