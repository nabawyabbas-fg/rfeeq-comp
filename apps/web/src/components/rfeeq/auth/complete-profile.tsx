"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Checkbox, Field, Hint, Input, Select } from "../ui/field";
import { AuthHeading, AuthLayout } from "./auth-layout";

/** The range offered for a year of birth. */
const YEAR_NOW = new Date().getFullYear();
const YEAR_MIN = YEAR_NOW - 100;

const NAME_HINT: Record<string, string> = {
  google: "أُخذ الاسم من حسابك في Google، ويمكنك تعديله.",
  apple: "أرسلت Apple اسمك مع أول تسجيل دخول فقط، فراجعه قبل المتابعة.",
};

/**
 * The last step before the chat: a name, a year, and consent.
 *
 * Three fields and no more. The brief's الخصوصية criterion forbids collecting
 * personal data beyond what is needed, and each of these earns its place — the
 * name is what the greeting and the account menu say, the year serves
 * الجودة الدعوية by letting an answer be pitched, and the consent is the
 * acceptance the privacy policy has to be able to point at. Both of the first
 * two are explicitly marked as account-only, because a reader asked for a birth
 * year is owed a reason.
 */
export function CompleteProfile({
  defaultName,
  provider,
}: {
  defaultName: string;
  provider: "google" | "apple" | null;
}) {
  const [name, setName] = useState(defaultName);
  const [year, setYear] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "أدخل اسمك";
    if (!year) next.year = "اختر سنة ميلادك";
    if (!consent) {
      next.consent = "يلزم الموافقة على الشروط وسياسة الخصوصية للمتابعة";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const { error } = await authClient.updateUser({
      name: name.trim(),
      birthYear: Number(year),
      // the moment of acceptance, which is what makes the record meaningful
      consentAt: new Date(),
    });
    setSaving(false);

    if (error) {
      toast.error("تعذّر حفظ ملفك. حاول مرة أخرى.");
      return;
    }

    // a full navigation, not a router push: the shell reads the session on the
    // server and has to pick up the new name
    window.location.assign("/");
  };

  return (
    <AuthLayout>
      <AuthHeading title="أكمل ملفك الشخصي">
        خطوة أخيرة قبل أن تبدأ. نحتاج اسمك وسنة ميلادك.
      </AuthHeading>

      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label="الاسم"
          htmlFor="rf-name"
          error={errors.name}
          hint={provider ? NAME_HINT[provider] : "يظهر في حسابك فقط."}
        >
          <Input
            id="rf-name"
            autoComplete="name"
            enterKeyHint="next"
            placeholder="اسمك الكريم"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label="سنة الميلاد"
          htmlFor="rf-year"
          error={errors.year}
          hint="تظهر في حسابك فقط."
        >
          <Select
            id="rf-year"
            value={year}
            autoComplete="bday-year"
            placeholder="اختر السنة"
            onChange={(event) => setYear(event.target.value)}
          >
            {Array.from({ length: YEAR_NOW - YEAR_MIN + 1 }, (_, index) => {
              const value = YEAR_NOW - index;
              return (
                <option key={value} value={value}>
                  {value}
                </option>
              );
            })}
          </Select>
        </Field>

        <Field error={errors.consent}>
          <Checkbox
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          >
            أوافق على <Link href="/about#terms">الشروط</Link> و
            <Link href="/about#privacy">سياسة الخصوصية</Link>
          </Checkbox>
        </Field>

        <Button type="submit" block isLoading={saving}>
          {saving ? "جارٍ الحفظ" : "متابعة"}
        </Button>

        <Hint>ستُضاف محادثتك الحالية إلى سجلّك بعد إكمال الملف.</Hint>
      </form>
    </AuthLayout>
  );
}
