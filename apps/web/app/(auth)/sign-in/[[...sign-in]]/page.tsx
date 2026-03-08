import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import AuthBrandingPanel from "@/components/auth/AuthBrandingPanel";

const clerkAppearance = {
  variables: {
    borderRadius: "10px",
    colorPrimary: "#007AFF",
    fontFamily: "Inter, sans-serif",
    colorBackground: "transparent",
  },
  elements: {
    card: "shadow-none border-0 bg-transparent",
    formButtonPrimary:
      "bg-[#007AFF] rounded-xl h-11 text-sm font-semibold hover:bg-[#0066D6]",
    formFieldInput:
      "rounded-xl border-[#D1D1D6] focus:border-[#007AFF] focus:ring-0",
  },
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left — branding (hidden on mobile) */}
      <div className="w-1/2 hidden lg:block">
        <AuthBrandingPanel />
      </div>

      {/* Right — form */}
      <div className="flex w-full flex-col items-center justify-center bg-[#F2F2F7] dark:bg-[#1C1C1E] px-4 lg:w-1/2">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#007AFF]">
            <span className="text-base font-bold text-white">R</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Robin.dev
          </span>
        </div>

        <div className="w-full max-w-sm">
          <SignIn appearance={clerkAppearance} />
        </div>

        <Link
          href="/"
          className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Torna alla homepage
        </Link>
      </div>
    </div>
  );
}
