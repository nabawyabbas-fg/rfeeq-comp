import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The muṣḥaf hand has exactly one weight.
 *
 * `--font-rf-quran` is KFGQPC Uthmanic Script HAFS, which ships
 * `usWeightClass: 400` and no bold cut. `font-semibold` beside it is therefore
 * not a heavier face but the browser drawing each glyph twice at an offset,
 * which on a script carrying tashkīl runs the marks into the letters under
 * them. v1.10 asks for weight 400 on revealed text anyway.
 *
 * A source scan rather than a render test, because the risk is a *new* call
 * site: there are nine places that set the Qurʾānic face, across the answer,
 * the panes, the settings page and the sign-in screen, and the next one added
 * will reach for `font-semibold` out of habit.
 */
const ROOT = join(import.meta.dirname, "../src/components/rfeeq");

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });

/** Class lists that name the Qurʾān face, one per occurrence. */
const quranicClassLists = (source: string) =>
  [...source.matchAll(/"([^"\n]*\bfont-rf-quran\b[^"\n]*)"/g)].map((m) => m[1]!);

describe("every place that sets the Qurʾānic face", () => {
  const found = files(ROOT).flatMap((path) =>
    quranicClassLists(readFileSync(path, "utf8")).map((list) => ({
      path: path.slice(ROOT.length + 1),
      list,
    })),
  );

  it("exists in more than one component, so the rule is worth holding", () => {
    expect(found.length).toBeGreaterThan(5);
  });

  it("never asks for a weight the face does not have", () => {
    const bold = found.filter(
      ({ list }) => /\bfont-(semibold|bold|medium|black|extrabold)\b/.test(list),
    );
    expect(bold).toEqual([]);
  });
});

/**
 * ﴿ ﴾ and the verse come from different faces, so their alignment is arithmetic.
 *
 * Amiri Quran's ornate parenthesis spans em[-0.416, +0.746]; the letters of
 * KFGQPC Uthmanic span em[-0.443, +0.683] across ا ج ل ي ن م ه ك ط ص ض. At 1em
 * the bracket is therefore already the right height — 1.162em against 1.126em —
 * and its centre sits 0.045em above the letters'. That one number is the whole
 * correction.
 *
 * What it replaced: a fixed `text-[24px]` with `align-middle` — a size 1.5× the
 * text it enclosed, and a vertical-align keyed to the parent's x-height, which
 * Arabic does not really have.
 */
describe("the ornate brackets", () => {
  const sources = files(ROOT).map((path) => ({
    path: path.slice(ROOT.length + 1),
    text: readFileSync(path, "utf8"),
  }));

  const bracketLines = sources.flatMap(({ path, text }) =>
    text
      .split("\n")
      .map((line, index) => ({ path, line, number: index + 1 }))
      .filter(({ line }) => line.includes("font-rf-mushaf")),
  );

  it("are set in Amiri Quran in both quote renderers", () => {
    const where = new Set(bracketLines.map((b) => b.path));
    expect(where).toContain("chat/section.tsx");
    expect(where).toContain("chat/answer-body.tsx");
  });

  it("are sized against the verse, never at a fixed pixel size", () => {
    const fixed = bracketLines.filter(({ line }) => /text-\[\d+px\]/.test(line));
    expect(fixed).toEqual([]);
  });

  it("are aligned on the baseline by the measured offset", () => {
    const quranic = bracketLines.filter(({ line }) =>
      line.includes("font-rf-mushaf text-[1em]"),
    );
    expect(quranic.length).toBeGreaterThan(0);
    for (const { line } of quranic) {
      expect(line).toContain("[vertical-align:-0.045em]");
    }
    // the x-height-based alignment the measurement replaced
    expect(bracketLines.filter((b) => b.line.includes("align-middle"))).toEqual(
      [],
    );
  });
});

/**
 * The two Arabic hands are for the two texts that have one.
 *
 * Everything else — a dorar page, a library article, a terminology entry, the
 * answer's own prose — is IBM Plex Sans Arabic, the UI face. The source card is
 * where this is easiest to get wrong: it shows *every* kind of retrieved
 * passage through one component, and a two-way branch there sent everything
 * that was not a verse to the muṣḥaf hand, which dresses a scraped article as
 * scripture.
 */
describe("which text gets a hand of its own", () => {
  const sourceCard = readFileSync(join(ROOT, "chat/sources.tsx"), "utf8");

  it("gives the source card three faces, not two", () => {
    expect(sourceCard).toContain('kindOf(chunk) === "quran"');
    expect(sourceCard).toContain('kindOf(chunk) === "hadith"');
    expect(sourceCard).toContain("font-rf-ui");
  });

  it("keeps the answer's own prose in the UI face", () => {
    const body = readFileSync(join(ROOT, "chat/answer-body.tsx"), "utf8");
    // ANSWER_PROSE, the contract every generated paragraph renders under
    expect(body).toMatch(/"font-rf-ui text-rf-answer text-rf-text"/);
  });
});
