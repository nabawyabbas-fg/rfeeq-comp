import { NextResponse } from "next/server";
import { env } from "@/env";
import { ratelimit } from "@/lib/api/rate-limit";
import { generateFollowUps } from "@/lib/rfeeq/follow-ups";
import { z } from "zod/v4";

/**
 * Suggests what to ask next, given the exchange that just happened.
 *
 * Its own route rather than part of the chat stream: it must not hold up the
 * first token, and a failure here should cost a suggestion, never an answer.
 */
const schema = z.object({
  question: z.string().min(2).max(2000),
  answer: z.string().min(1).max(20000),
});

export const POST = async (req: Request) => {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await ratelimit(30, "1 m").limit(`rfeeq-followups:${ip}`);
  if (!success) {
    // no suggestions is a fine outcome; the reader loses nothing they had
    return NextResponse.json({ questions: [] });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ questions: [] });

  const questions = await generateFollowUps(
    parsed.data.question,
    parsed.data.answer,
    env.OPENAI_API_KEY,
  );

  return NextResponse.json({ questions });
};
