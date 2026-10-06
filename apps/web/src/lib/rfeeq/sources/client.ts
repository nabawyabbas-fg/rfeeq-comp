import { assertAllowed } from "./allowlist";

/**
 * How long a single source call may take before the answer gives up on it.
 *
 * Short on purpose. These calls sit inside an agentic loop that may make
 * several of them before writing a word, so a slow source costs the reader
 * directly. A source that cannot answer in six seconds is better reported as
 * unavailable than waited on — the answer can say what it could not reach,
 * which is what criterion 4 asks for anyway.
 */
const TIMEOUT_MS = 6_000;

export class SourceUnavailableError extends Error {
  constructor(
    readonly host: string,
    readonly cause_: unknown,
  ) {
    super(`Source ${host} did not answer`);
    this.name = "SourceUnavailableError";
  }
}

/**
 * Fetches JSON from an approved source.
 *
 * The allow-list assertion happens here, before the request, so there is
 * exactly one place in the system where an outbound retrieval URL is decided to
 * be acceptable. Adapters cannot bypass it without bypassing this function,
 * which is the point.
 */
export const fetchSource = async <T>(url: string): Promise<T> => {
  assertAllowed(url);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Identifies the caller to the platforms, which are run by a charity
        // publishing this material freely; an anonymous scraper is a worse
        // citizen than a named one.
        "User-Agent": "RfeeqBot/1.0 (+https://comp.rfeeq.ai)",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Retrieval is read-only and the content is effectively static, so the
      // platform's own caching headers are the right ones to honour.
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    throw new SourceUnavailableError(new URL(url).host, error);
  }
};

/** Builds a query string, dropping empty values rather than sending them. */
export const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
};
