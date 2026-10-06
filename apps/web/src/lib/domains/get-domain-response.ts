import type { DomainResponse } from "@/types/vercel";
import { env } from "@/env";

import { callVercelApi } from "./utils";

export const getDomainResponse = async (domain: string) => {
  return callVercelApi<
    DomainResponse & { error?: { code: string; message: string } }
  >(
    `/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${domain.toLowerCase()}`,
    "GET",
  );
};
