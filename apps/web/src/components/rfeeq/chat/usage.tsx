"use client";

import type { QuranForm, QuranUsage } from "@/lib/rfeeq/sources/mcp/lexicon";

/**
 * «الاستعمال القرآني» — the specification's §6 addition, which it states as a
 * sentence and a table:
 *
 *   «ورد الجذر (…) في القرآن (…) مرة.»
 *   «الصيغة | عدد المرات | المثال»
 *
 * Built from the concordance rather than written, for the same reason the
 * grading is: these are checkable numbers, and a model asked to repeat «ورد
 * الجذر وقي ٢٥٨ مرة» in prose is one digit away from being wrong about
 * something a reader can verify in a minute.
 *
 * The example column gives a reference rather than the āya's words. A form
 * occurring thirty-eight times has no single text to quote, and quoting one
 * would imply it does.
 */

const asUsage = (value: unknown): QuranUsage | null => {
  if (!value || typeof value !== "object") return null;
  const usage = value as Partial<QuranUsage>;
  return typeof usage.root === "string" && Array.isArray(usage.forms)
    ? (usage as QuranUsage)
    : null;
};

/** Reads the usage off a chunk's metadata, or null when it is not one. */
export const usageOf = (metadata: Record<string, unknown> | undefined) =>
  asUsage(metadata?.usage);

const Example = ({ form }: { form: QuranForm }) =>
  form.example ? (
    <span className="tabular-nums" dir="ltr">
      {form.example.surah}:{form.example.ayah}
    </span>
  ) : (
    <>—</>
  );

export function QuranUsageTable({
  usage,
  summary,
}: {
  usage: QuranUsage;
  /** The sentence, as the retrieval layer composed it from the same figures. */
  summary: string;
}) {
  return (
    <div className="my-3 grid grid-cols-1 gap-2">
      <p dir="auto">{summary}</p>

      {usage.forms.length > 0 ? (
        /* its own scroll container, so the answer body never scrolls sideways */
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>الصيغة</th>
                <th>عدد المرات</th>
                <th>المثال</th>
              </tr>
            </thead>
            <tbody>
              {usage.forms.map((form) => (
                <tr key={form.form}>
                  <td dir="rtl" lang="ar" className="font-rf-quran">
                    {form.form}
                  </td>
                  <td className="tabular-nums">{form.count ?? "—"}</td>
                  <td>
                    <Example form={form} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
