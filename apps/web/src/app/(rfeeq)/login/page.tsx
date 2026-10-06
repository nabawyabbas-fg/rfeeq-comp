import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignIn } from "@/components/rfeeq/auth/sign-in";
import { getSession } from "@/lib/auth";
import { PROFILE_PATH, isProfileComplete } from "@/lib/rfeeq/profile";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const session = await getSession();

  if (session) {
    // Where a signed-in reader goes depends on their profile, which is why this
    // decision lives here rather than in the middleware.
    redirect(isProfileComplete(session.user) ? "/" : PROFILE_PATH);
  }

  const context = typeof params.ctx === "string" ? params.ctx : undefined;

  /*
   * Both the OTP verify and the social callback send the reader to `?r=`, and
   * that has to be the completion step: a brand-new account arrives with no
   * name and no consent on record, and the step itself forwards a finished
   * profile straight on to the chat. Set by one redirect on first arrival so
   * the rest of the flow can simply read it.
   */
  if (typeof params.r !== "string") {
    const query = new URLSearchParams({ r: PROFILE_PATH });
    if (context) query.set("ctx", context);
    redirect(`/login?${query.toString()}`);
  }

  return <SignIn context={context} />;
}
