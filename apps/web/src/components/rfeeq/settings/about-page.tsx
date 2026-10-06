import { APP_NAME } from "@/lib/constants";

import { cn } from "@agentset/ui/cn";

import type { RfeeqIconName } from "../icon-sprite";
import { Icon } from "../icon";
import { Card } from "../ui/feedback";
import { SettingsFrame } from "./frame";

/**
 * How Rfeeq answers — the system's own account of its discipline.
 *
 * Not marketing copy. Each line names a rule the answers actually follow, and
 * together they are the brief's binding criteria stated in the second person:
 * الموثوقية والإسناد, التمييز بين القطعي والاجتهادي, عدم الاستقلال بالفتوى.
 * A reader deciding how far to trust an answer needs to be able to read the
 * rules it was written under, which is also criterion 7, الشفافية.
 */
const PRINCIPLES: { icon: RfeeqIconName; title: string; body: string }[] = [
  {
    icon: "shield",
    title: "المصدر أولًا.",
    body: "كل إجابة تحمل مصادرها مرقّمة، ويمكنك فتح كل مصدر ومقتطفه ومرجعه الكامل.",
  },
  {
    icon: "hadith",
    title: "الأحكام تُنقل ولا تُختلق.",
    body: "درجة الحديث تظهر باسم صاحبها ونصّها، وإذا اختلف الحكّام عُرضت الدرجات جنبًا إلى جنب دون ترجيح من التطبيق.",
  },
  {
    icon: "library",
    title: "لا خلط بين المذاهب.",
    body: "كل قول في فتوى يُنسب إلى مذهبه أو مفتيه في كتلة مستقلة، ولا تُدمج الأقوال في حكم واحد.",
  },
  {
    icon: "layers",
    title: "الأدلة مرتّبة.",
    body: "إذا قامت المسألة على دليلين فأكثر عُرضت مرتّبة: القرآن، ثم السنة، ثم الإجماع، ثم القياس.",
  },
  {
    icon: "info",
    title: "لا فتوى في حالتك.",
    body: "إذا كان سؤالك عن واقعة تخصّك، عرض رفيق المعلومات العامة من المصادر وأحالك إلى جهة إفتاء مؤهلة، ولم يُصدر حكمًا.",
  },
  {
    icon: "zap",
    title: "الجواب أولًا، والتفصيل عند الطلب.",
    body: "تبدأ كل إجابة بأقصر صورة صحيحة، وتفاصيل المصادر في لوحة جانبية لمن أرادها.",
  },
];

export function AboutPage({ version }: { version: string }) {
  return (
    <SettingsFrame title="عن رفيق">
      <Card>
        <h3>كيف يجيب رفيق</h3>

        {PRINCIPLES.map((principle) => (
          <div
            key={principle.title}
            className="font-rf-ui text-rf-text-2 flex items-start gap-2 text-[13px]/[1.7]"
          >
            <Icon name={principle.icon} size="sm" className="mt-1 shrink-0" />
            <span>
              <b className="text-rf-text font-semibold">{principle.title}</b>{" "}
              {principle.body}
            </span>
          </div>
        ))}
      </Card>

      <Card>
        <h3>ما هو رفيق</h3>
        <p>
          {APP_NAME} أداة مدعومة بالذكاء الاصطناعي تبحث في مصادر معتمدة وتعرض ما
          وجدته منسوبًا إلى أصحابه. ليس مفتيًا، ولا يحلّ محلّ سؤال أهل العلم في
          حالتك الخاصة.
        </p>
      </Card>

      <Card className="py-2">
        <AboutRow id="terms" label="الشروط" />
        <AboutRow id="privacy" label="سياسة الخصوصية" />
        <div className={ROW}>
          <span>تواصل معنا</span>
          <span dir="ltr" className="text-rf-text-2 font-normal">
            support@rfeeq.ai
          </span>
        </div>
        <div className={cn(ROW, "border-b-0")}>
          <span>رقم الإصدار</span>
          <span className="text-rf-text-2 font-normal">{version}</span>
        </div>
      </Card>
    </SettingsFrame>
  );
}

const ROW =
  "flex min-h-11 items-center justify-between gap-3 border-b border-rf-line py-1 font-rf-ui text-sm/[1.6] font-medium text-rf-text";

/**
 * A policy section.
 *
 * Anchored rather than linked out: the consent checkbox points here, and a
 * reader asked to agree to terms should not have to leave the flow to read
 * them. The texts themselves are not written yet — this names where they go
 * rather than pretending they exist.
 */
function AboutRow({ id, label }: { id: string; label: string }) {
  return (
    <div id={id} className={ROW}>
      <span>{label}</span>
      <span className="text-rf-text-3 font-normal">قيد الإعداد</span>
    </div>
  );
}
