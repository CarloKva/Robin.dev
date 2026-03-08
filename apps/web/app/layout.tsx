import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
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
      <html lang="en" className={geist.variable}>
        <body className="font-sans">{children}</body>
      </html>
    </ClerkProvider>
  );
}
