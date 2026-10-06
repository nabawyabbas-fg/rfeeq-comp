"use client";

import { useEffect, useState } from "react";
import { useOtpAuth } from "@/hooks/use-auth";

import { cn } from "@agentset/ui/cn";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@agentset/ui/input-otp";

import { Icon } from "../icon";
import { Button } from "../ui/button";
import { EmailInput, ErrorMessage, Field } from "../ui/field";
import { AuthHeading, AuthLayout } from "./auth-layout";
import { AuthMethods } from "./auth-methods";
import { SIGN_IN_CONTEXT } from "./guest-wall";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ERR_EMAIL = "أدخل بريدًا إلكترونيًا صحيحًا، مثل name@example.com";

/** Seconds before a new code can be requested. */
const RESEND_AFTER = 30;

type Step = "methods" | "email" | "code";

/**
 * Sign in, or create an account — one flow, because they are the same act here.
 *
 * There is no password anywhere in it. A six-digit code to an address the
 * reader already controls proves the same thing a password does, with nothing
 * to forget, reuse or leak; the two social options exist because they are one
 * tap for people who have them. What is not asked for at this point matters as
 * much as what is: no name, no profile, nothing beyond the address, until after
 * the account exists.
 */
export function SignIn({ context }: { context?: string }) {
  const [step, setStep] = useState<Step>("methods");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const {
    otp,
    setOtp,
    error: otpError,
    sendOtp,
    isSendingOtp,
    verifyOtp,
    isVerifyingOtp,
    reset,
  } = useOtpAuth();

  const reason = context ? SIGN_IN_CONTEXT[context] : null;

  const submitEmail = async () => {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setEmailError(ERR_EMAIL);
      return;
    }
    setEmailError(null);
    await sendOtp(value);
    setStep("code");
  };

  return (
    <AuthLayout>
      {step === "methods" ? (
        <>
          <AuthHeading title="تسجيل الدخول أو إنشاء حساب">
            اختر طريقة الدخول. الحساب نفسه يُنشأ تلقائيًا إن لم يكن لديك واحد.
          </AuthHeading>

          {reason ? (
            <p className="rounded-rf-md bg-rf-accent-soft font-rf-ui text-rf-accent flex items-center gap-3 px-4 py-3 text-sm/[1.6] font-semibold">
              <Icon name="info" className="shrink-0" />
              <span>{reason}</span>
            </p>
          ) : null}

          <AuthMethods onEmail={() => setStep("email")} />
        </>
      ) : null}

      {step === "email" ? (
        <>
          <BackLink onClick={() => setStep("methods")} />
          <AuthHeading title="أدخل بريدك الإلكتروني">
            سنرسل إليك رمزًا من 6 أرقام لتأكيد بريدك. لا حاجة إلى كلمة مرور.
          </AuthHeading>

          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitEmail();
            }}
          >
            <Field
              label="البريد الإلكتروني"
              htmlFor="rf-email"
              error={emailError}
            >
              <EmailInput
                id="rf-email"
                autoFocus
                enterKeyHint="send"
                placeholder="example@email.com"
                value={email}
                aria-invalid={emailError ? true : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError(null);
                }}
              />
            </Field>

            <Button type="submit" block isLoading={isSendingOtp}>
              {isSendingOtp ? "جارٍ الإرسال" : "إرسال الرمز"}
            </Button>
          </form>
        </>
      ) : null}

      {step === "code" ? (
        <CodeStep
          email={email}
          otp={otp}
          setOtp={setOtp}
          error={otpError}
          verifying={isVerifyingOtp}
          onVerify={() => void verifyOtp(email)}
          onResend={() => void sendOtp(email)}
          resending={isSendingOtp}
          onChangeEmail={() => {
            reset();
            setStep("email");
          }}
        />
      ) : null}
    </AuthLayout>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-rf-sm -ms-3 inline-flex min-h-8 w-fit cursor-pointer items-center gap-2 border-0 bg-transparent px-3",
        "font-rf-ui text-rf-accent hover:bg-rf-accent-soft text-[13px] font-semibold",
      )}
    >
      <Icon name="back" size="sm" mirror />
      رجوع
    </button>
  );
}

function CodeStep({
  email,
  otp,
  setOtp,
  error,
  verifying,
  onVerify,
  onResend,
  resending,
  onChangeEmail,
}: {
  email: string;
  otp: string;
  setOtp: (value: string) => void;
  error: string | null;
  verifying: boolean;
  onVerify: () => void;
  onResend: () => void;
  resending: boolean;
  onChangeEmail: () => void;
}) {
  // A resend button that is live immediately invites a second code before the
  // first has arrived, and the second invalidates the first — which reads as
  // the codes not working at all.
  const [countdown, setCountdown] = useState(RESEND_AFTER);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <>
      <BackLink onClick={onChangeEmail} />
      <AuthHeading title="أدخل رمز التحقق">
        أرسلنا رمزًا من 6 أرقام إلى
        <br />
        <bdi
          dir="ltr"
          className="font-rf-ui text-rf-text text-[15px]/[1.8] font-semibold"
        >
          {email}
        </bdi>
      </AuthHeading>

      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          onVerify();
        }}
      >
        {/* LTR: a numeric code reads left to right even in an RTL form, and the
            first box must be the first digit typed. */}
        <div dir="ltr" className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            onComplete={onVerify}
            autoFocus
            aria-label="رمز التحقق المكوّن من 6 أرقام"
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className={cn(
                    "rounded-rf-md border-rf-line-strong bg-rf-surface size-12 border-[1.5px]",
                    "font-rf-ui text-rf-text text-xl font-semibold",
                    "data-[active=true]:border-rf-accent data-[active=true]:ring-0",
                    error && "border-rf-danger",
                  )}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div aria-live="polite" className="min-h-7">
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        </div>

        <Button
          type="submit"
          block
          isLoading={verifying}
          disabled={otp.length !== 6}
        >
          {verifying ? "جارٍ التحقق" : "تأكيد"}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={countdown > 0 || resending}
            onClick={() => {
              onResend();
              setCountdown(RESEND_AFTER);
            }}
          >
            {countdown > 0
              ? `إعادة إرسال الرمز بعد ${countdown} ثانية`
              : "إعادة إرسال الرمز"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onChangeEmail}>
            تغيير البريد الإلكتروني
          </Button>
        </div>
      </form>
    </>
  );
}
