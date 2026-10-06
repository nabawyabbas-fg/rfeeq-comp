import { NextResponse } from "next/server";
import { ratelimit } from "@/lib/api/rate-limit";
import {
  ayahSciences,
  surahSciences,
  wordSciences,
} from "@/lib/rfeeq/sources/mcp/sciences";
import { z } from "zod/v4";

/**
 * علوم القرآن for a side panel, fetched when the reader opens one.
 *
 * On demand rather than with the answer, and that is the specification's own
 * logic rather than an optimisation: «مهمة البطاقة أن تَعُدّ وتُلخّص ثم تفتح
 * عند الطلب». Eight sciences for every verse in every answer would be a great
 * deal of retrieval for material most readers never open — and would slow the
 * one thing they are waiting for.
 *
 * Its own route for the same reason the follow-ups have one: a panel that fails
 * to load should cost the reader a panel, never an answer.
 */

const schema = z.object({
  view: z.enum(["surah", "ayah", "word"]),
  surah: z.coerce.number().int().min(1).max(114),
  ayah: z.coerce.number().int().min(1).max(286).optional(),
  /** 1-based, as مركز تفسير numbers the words of an āya. */
  word: z.coerce.number().int().min(1).max(200).optional(),
  /*
   * Accepted and ignored.
   *
   * The pane lists every edition now — the level scopes what the *answer* rests
   * on, not a reference a reader opened deliberately. Kept in the schema
   * because the client still sends it and it is part of the cache key there, so
   * rejecting it would turn a stale tab into an error rather than a reload.
   */
  expertise: z.enum(["general", "specialist"]).optional(),
});

export const GET = async (req: Request) => {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  /*
   * Generous, because one panel is several of these: opening a verse and then
   * three of its words is four requests from one reader in a few seconds, and
   * each is a cheap read against a free public server.
   */
  const { success } = await ratelimit(60, "1 m").limit(`rfeeq-sciences:${ip}`);
  if (!success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = schema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { view, surah, ayah, word } = parsed.data;

  try {
    if (view === "surah") {
      const data = await surahSciences(surah);
      return data
        ? NextResponse.json({ view, data })
        : NextResponse.json({ error: "unavailable" }, { status: 502 });
    }

    if (!ayah) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    if (view === "ayah") {
      return NextResponse.json({
        view,
        /* every edition, whoever is reading — the level scopes the answer,
           not a reference pane the reader opened on purpose */
        data: await ayahSciences(surah, ayah),
      });
    }

    if (!word) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    const data = await wordSciences(surah, ayah, word);
    return data
      ? NextResponse.json({ view, data })
      : NextResponse.json({ error: "unavailable" }, { status: 502 });
  } catch {
    /*
     * The source could not be reached. Reported as such rather than as an empty
     * panel, so the reader is told the difference between "this āya has no
     * recorded sabab" and "we could not ask".
     */
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
};
