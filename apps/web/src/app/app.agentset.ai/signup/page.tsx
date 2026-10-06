import type { Metadata } from "next";
import { GradientBackground } from "@/components/gradient-background";
import { configuredSocialProviders } from "@/lib/social-providers";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create an account",
};

export const dynamic = "force-static";

export default function SignupPage() {
  return (
    <main className="overflow-hidden bg-gray-50">
      <GradientBackground />
      <div className="isolate flex min-h-dvh flex-col items-center justify-center gap-4 p-6 lg:p-8">
        <SignupForm socialProviders={configuredSocialProviders()} />
      </div>
    </main>
  );
}
