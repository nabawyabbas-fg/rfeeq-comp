-- Persist the per-answer cost/latency breakdown alongside the message.
--
-- Nullable with no default: user turns have no metrics, and conversations saved
-- before this column existed keep NULL, which the UI renders by omitting the
-- breakdown rather than showing zeros.
ALTER TABLE "chat_message" ADD COLUMN "metadata" JSONB;
