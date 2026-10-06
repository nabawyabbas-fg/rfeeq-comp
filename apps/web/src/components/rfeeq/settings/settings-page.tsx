"use client";

import { useState } from "react";
import { useViewer } from "@/contexts/rfeeq-context";
import { authClient } from "@/lib/auth-client";
import { ANSWER_DEPTHS } from "@/lib/rfeeq/answer-depth";
import { EXPERTISE_LEVELS } from "@/lib/rfeeq/expertise";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { Icon } from "../icon";
import { FONT_SIZES, usePreferences } from "../preferences";
import { Button } from "../ui/button";
import { ConfirmDestructive } from "../ui/confirm";
import { Card, Segmented, State } from "../ui/feedback";
import { Checkbox, Field, Hint, Input, Select } from "../ui/field";
import { SettingsFrame } from "./frame";

const YEAR_NOW = new Date().getFullYear();
const YEAR_MIN = YEAR_NOW - 100;

const PROVIDER_LABEL: Record<string, string> = {
  google: "حساب Google",
  apple: "حساب Apple",
  email: "البريد الإلكتروني (رمز التحقق)",
};

/**
 * Settings, as one page.
 *
 * v1.4 collapsed the section navigation: there are four short sections and a
 * rail to move between them was more chrome than content. They read top to
 * bottom in the order a reader cares about them — who they are, how they want
 * to read, what they are paying, and what the system holds about them.
 */
export function SettingsPage({
  birthYear,
  signInMethod,
}: {
  birthYear: number | null;
  signInMethod: string;
}) {
  /*
   * The route redirects an unauthenticated reader to sign-in before this
   * renders, so there is no guest branch here. The prototype had one; it would
   * be unreachable code, and unreachable code is worse than absent code —
   * it reads as a state the product supports.
   */
  const viewer = useViewer();
  const name = viewer?.name ?? "";
  const email = viewer?.email ?? "";

  return (
    <SettingsFrame title="الإعدادات">
      <AccountSection
        name={name}
        email={email}
        birthYear={birthYear}
        signInMethod={signInMethod}
      />
      <PreferencesSection />
      <PlanSection />
      <PrivacySection />

      <Button
        variant="secondary"
        className="mt-4 justify-self-start"
        onClick={async () => {
          await authClient.signOut();
          window.location.assign("/");
        }}
      >
        <Icon name="logout" mirror />
        تسجيل الخروج
      </Button>
    </SettingsFrame>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-rf-ui text-rf-h3 text-rf-text mt-4 font-bold">
      {children}
    </h2>
  );
}

function AccountSection({
  name: initialName,
  email,
  birthYear,
  signInMethod,
}: {
  name: string;
  email: string;
  birthYear: number | null;
  signInMethod: string;
}) {
  const [name, setName] = useState(initialName);
  const [year, setYear] = useState(birthYear ? String(birthYear) : "");
  const [saving, setSaving] = useState(false);

  const dirty =
    name.trim() !== initialName ||
    year !== (birthYear ? String(birthYear) : "");

  const save = async () => {
    setSaving(true);
    const { error } = await authClient.updateUser({
      name: name.trim(),
      ...(year ? { birthYear: Number(year) } : {}),
    });
    setSaving(false);

    if (error) {
      toast.error("تعذّر حفظ التغييرات");
      return;
    }
    toast.success("حُفظت التغييرات");
    // the shell reads the session on the server, so the new name needs a
    // round trip to reach the account menu
    window.location.reload();
  };

  return (
    <>
      <SectionHeading>الحساب</SectionHeading>
      <Card>
        <Field label="الاسم" htmlFor="rf-set-name">
          <Input
            id="rf-set-name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field label="سنة الميلاد" htmlFor="rf-set-year">
          <Select
            id="rf-set-year"
            value={year}
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

        <Field
          label="البريد الإلكتروني"
          htmlFor="rf-set-email"
          hint="لا يمكن تغيير البريد الإلكتروني."
        >
          <Input
            id="rf-set-email"
            dir="ltr"
            className="text-right"
            value={email}
            disabled
          />
        </Field>

        <div className="font-rf-ui flex min-h-11 items-center justify-between gap-3 text-sm/[1.6] font-medium">
          <span>طريقة الدخول</span>
          <span className="text-rf-text-2 font-normal">
            {PROVIDER_LABEL[signInMethod]}
          </span>
        </div>

        <Button
          className="justify-self-start"
          disabled={!dirty}
          isLoading={saving}
          onClick={() => void save()}
        >
          حفظ التغييرات
        </Button>
      </Card>
    </>
  );
}

function PreferencesSection() {
  const { theme, setTheme } = useTheme();
  const fontSize = usePreferences((state) => state.fontSize);
  const setFontSize = usePreferences((state) => state.setFontSize);
  const answerDepth = usePreferences((state) => state.answerDepth);
  const setAnswerDepth = usePreferences((state) => state.setAnswerDepth);
  const expertise = usePreferences((state) => state.expertise);
  const setExpertise = usePreferences((state) => state.setExpertise);

  return (
    <>
      <SectionHeading>التفضيلات</SectionHeading>
      <Card>
        <PreferenceRow label="حجم الخط">
          <Segmented
            label="حجم الخط"
            wide
            options={FONT_SIZES}
            value={fontSize}
            onChange={setFontSize}
          />
        </PreferenceRow>

        <PreferenceRow label="السمة">
          <Segmented
            label="السمة"
            wide
            options={[
              { value: "light", label: "فاتح" },
              { value: "dark", label: "داكن" },
              { value: "system", label: "تلقائي" },
            ]}
            /*
             * `theme`, not `resolvedTheme`: this control shows the *choice*,
             * and «تلقائي» is a choice resolvedTheme would hide behind whichever
             * of light or dark the OS happens to be reporting.
             *
             * The cast narrows next-themes' `string` to the three values this
             * control offers. A theme set to anything else is not possible here
             * — those three are all that can be written.
             */
            value={(theme ?? "system") as "light" | "dark" | "system"}
            onChange={setTheme}
          />
        </PreferenceRow>

        <PreferenceRow label="عمق الإجابة">
          <Segmented
            label="عمق الإجابة"
            wide
            options={ANSWER_DEPTHS}
            value={answerDepth}
            onChange={setAnswerDepth}
          />
        </PreferenceRow>

        <PreferenceRow label="مستوى القارئ">
          <Segmented
            label="مستوى القارئ"
            wide
            options={EXPERTISE_LEVELS}
            value={expertise}
            onChange={setExpertise}
          />
        </PreferenceRow>

        <Hint>
          عمق الإجابة يغيّر ما يُعرض من تفصيل، ولا يغيّر قواعد الإسناد: كل إجابة
          تحمل مصادرها، وكل حديث يحمل درجته واسم الحاكم، مهما كان العمق.
        </Hint>

        <Hint>
          مستوى القارئ يغيّر المصادر نفسها: العامّ يُقرأ له التفسير الميسر
          والمختصر بالفصحى البيضاء، والمتخصّص يُقرأ له الطبري وابن كثير والبغوي
          والسعدي بذكر الطبعة والاصطلاح العلمي.
        </Hint>
      </Card>

      <Card>
        <div className="font-rf-ui text-rf-text-3 text-xs/[1.6] font-medium">
          معاينة
        </div>
        <p className="font-rf-quran text-rf-answer-q text-rf-text m-0 font-normal">
          <span className="font-rf-mushaf text-rf-accent mx-1 text-[1em] font-normal [vertical-align:-0.045em]">
            ﴿
          </span>
          فَاسْأَلُوا أَهْلَ الذِّكْرِ إِن كُنتُمْ لَا تَعْلَمُونَ
          <span className="font-rf-mushaf text-rf-accent mx-1 text-[1em] font-normal [vertical-align:-0.045em]">
            ﴾
          </span>
        </p>
        <p className="font-rf-ui text-rf-text-2 m-0 text-[14.5px] font-medium">
          سورة النحل، الآية 43
        </p>
        <p className="font-rf-ui text-rf-answer text-rf-text m-0">
          والآية عامة في كل مسألة من مسائل الدين، إذا لم يكن عند الإنسان علم
          منها أن يسأل من يعلمها من العلماء الراسخين في العلم.
        </p>
      </Card>
    </>
  );
}

function PreferenceRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <span className="font-rf-ui text-rf-text text-xs/[1.6] font-semibold">
        {label}
      </span>
      {children}
    </div>
  );
}

function PlanSection() {
  return (
    <>
      <SectionHeading>الباقة</SectionHeading>
      <Card>
        <State
          icon="layers"
          title="قريبًا"
          description="نعمل على خيارات جديدة، وسنُعلمك بها هنا حين تصبح جاهزة."
        />
      </Card>
    </>
  );
}

/**
 * The two account-wide destructive actions.
 *
 * Both go through a real alert dialog rather than the prototype's inline
 * confirmation. These are final and account-wide — every saved conversation, or
 * the account itself — and an inline block a keyboard user can tab straight past
 * is not a confirmation. The inline form stays where it belongs, on a single
 * history row.
 *
 * Deleting the account additionally waits on an explicit acknowledgement, since
 * nothing brings it back.
 */
function PrivacySection() {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [working, setWorking] = useState(false);

  const clearHistory = async () => {
    setWorking(true);
    const res = await fetch("/api/chats", { method: "DELETE" });
    setWorking(false);
    setConfirmClear(false);

    if (!res.ok) {
      toast.error("تعذّر مسح السجل");
      return;
    }
    toast.success("مُسح سجل المحادثات");
  };

  const deleteAccount = async () => {
    setWorking(true);
    const { error } = await authClient.deleteUser();
    setWorking(false);

    if (error) {
      toast.error("تعذّر حذف الحساب");
      return;
    }
    window.location.assign("/");
  };

  return (
    <>
      <SectionHeading>الخصوصية والبيانات</SectionHeading>

      <Card>
        <h3>سجل المحادثات</h3>
        <p>يمسح كل المحادثات المحفوظة في حسابك.</p>
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => setConfirmClear(true)}
        >
          <Icon name="trash" />
          مسح سجل المحادثات
        </Button>
      </Card>

      <Card>
        <h3>حذف الحساب</h3>
        <p>يحذف حسابك وبياناتك من رفيق.</p>
        <Button
          variant="danger"
          className="justify-self-start"
          onClick={() => setConfirmDelete(true)}
        >
          <Icon name="trash" />
          حذف الحساب
        </Button>
      </Card>

      <ConfirmDestructive
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="مسح سجل المحادثات"
        description="سيُمسح سجل محادثاتك كله. لا يمكن التراجع عن هذا."
        confirmLabel="مسح السجل"
        isLoading={working}
        onConfirm={() => void clearHistory()}
      />

      <ConfirmDestructive
        open={confirmDelete}
        onOpenChange={(next) => {
          setConfirmDelete(next);
          if (!next) setAcknowledged(false);
        }}
        title="تأكيد حذف الحساب"
        description="سيُحذف حسابك وكل محادثاتك نهائيًا، ولا يمكن استرجاعها."
        confirmLabel="حذف الحساب نهائيًا"
        isLoading={working}
        onConfirm={() => {
          if (acknowledged) void deleteAccount();
        }}
      >
        <Checkbox
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        >
          أفهم أن حذف الحساب نهائي
        </Checkbox>
      </ConfirmDestructive>
    </>
  );
}
