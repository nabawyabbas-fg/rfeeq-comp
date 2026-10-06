export const LLM_MODELS = {
  openai: [
    { model: "gpt-4.1", name: "GPT-4.1" },
    { model: "gpt-5.5", name: "GPT-5.5" },
    { model: "gpt-5.2", name: "GPT-5.2" },
    { model: "gpt-5.1", name: "GPT-5.1" },
    { model: "gpt-5", name: "GPT-5" },
    { model: "gpt-5-mini", name: "GPT-5 Mini" },
    { model: "gpt-5-nano", name: "GPT-5 Nano" },
  ],
  google: [
    { model: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
    { model: "gemini-3.7-flash", name: "Gemini 3.7 Flash" },
    { model: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
    { model: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite" },
    { model: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { model: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
  ],
  openrouter: [
    { model: "moonshotai/kimi-k3", name: "Kimi K3" },
    { model: "moonshotai/kimi-k2-thinking", name: "Kimi K2 Thinking" },
    { model: "moonshotai/kimi-k2.6", name: "Kimi K2.6" },
  ],
  // anthropic: [
  //   { model: "claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  //   { model: "claude-haiku-4.5", name: "Claude Haiku 4.5" },
  // ],
} as const;

export const LLM_PROVIDERS: Record<keyof typeof LLM_MODELS, string> = {
  openai: "OpenAI",
  google: "Google",
  openrouter: "OpenRouter",
  // anthropic: "Anthropic",
};

export const LLM_MODEL_TO_PROVIDER: Record<LLM, keyof typeof LLM_PROVIDERS> =
  Object.fromEntries(
    Object.entries(LLM_MODELS).flatMap(([provider, models]) =>
      models.map((m) => [`${provider}:${m.model}`, provider]),
    ),
  ) as Record<LLM, keyof typeof LLM_PROVIDERS>;

type _LLMMap = {
  [T in keyof typeof LLM_MODELS]: `${T}:${(typeof LLM_MODELS)[T][number]["model"]}`;
};

export type LLM = _LLMMap[keyof _LLMMap];

export const DEFAULT_LLM: LLM = "openai:gpt-5.5";
