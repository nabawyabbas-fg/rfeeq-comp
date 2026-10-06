import { SharedAnswerGone } from "@/components/rfeeq/chat/shared-answer";

/**
 * A share link that names nothing.
 *
 * Rendered through the not-found boundary so the response actually carries a
 * 404 — a revoked link answering 200 tells every crawler and cache that there
 * is still something there.
 */
export default function ShareNotFound() {
  return <SharedAnswerGone />;
}
