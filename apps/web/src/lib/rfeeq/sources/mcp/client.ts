import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { SourceUnavailableError } from "../client";

/**
 * Model Context Protocol clients for the challenge's approved publishers.
 *
 * Two of the approved bodies publish MCP servers, and the brief lists that as
 * part of their technical availability — «واجهات برمجية عامة، قاعدة مركزية
 * موحّدة، وخادم MCP». Reading them over MCP rather than scraping their REST
 * APIs is therefore the publishers' own intended route, and it is a better one:
 * the servers return the grading and attribution fields as structured data, so
 * the brief's hadith rule can be *checked* instead of hoped for.
 *
 * Three things about this file are deliberate.
 *
 * **MCP is invisible to the reader.** It is a transport, and a transport is not
 * a source. Every citation this system renders is attributed to the publisher
 * whose text it is — «موسوعة الحديث», «موسوعة القرآن», «مركز تفسير» — and the
 * word MCP appears nowhere in the UI, in the prompt, or in a citation label. A
 * reader weighs a citation by who published it; telling them how the bytes
 * arrived would be noise at best and misdirection at worst.
 *
 * **Nothing is wired by the reader.** These are server-side connections to
 * fixed, public, read-only endpoints that need no registration and no key. The
 * reader asks a question; they do not connect anything, approve anything, or
 * know that a protocol was involved.
 *
 * **The gateway is not the source of record.** A request goes to
 * `mcp.islamiccontent.org`, and the document it returns was published at
 * `hadeethenc.com`. The allow-list cannot see that second hop, so the gateway
 * is admitted by its own short list here and every document it returns has its
 * publisher host re-checked against the allow-list in `documents.ts`. One check
 * for the connection we open, one for the provenance we display.
 */

export type McpServerId = "islamic-content" | "tafsir-center";

interface McpServer {
  endpoint: string;
  /**
   * The publisher's own name, in Arabic.
   *
   * Used when a server cannot be reached, so the answer says «تعذّر الوصول إلى
   * موسوعة الحديث» rather than naming a hostname the reader has never heard of.
   */
  publisher: string;
}

/**
 * The gateways, and only these.
 *
 * A short, closed list for the same reason `allowlist.ts` is one: the set of
 * endpoints this system will open a connection to is a decision to be made
 * once, in writing, not derived at runtime from whatever a tool argument says.
 */
const SERVERS: Record<McpServerId, McpServer> = {
  /*
   * The joint server over موسوعة القرآن الكريم, موسوعة الأحاديث النبوية and
   * موسوعة المحتوى الإسلامي باللغات — three platforms the brief approves by
   * name, behind one endpoint.
   */
  "islamic-content": {
    endpoint: "https://mcp.islamiccontent.org/mcp",
    publisher: "الموسوعات المعتمدة",
  },
  /*
   * مركز تفسير للدراسات القرآنية. The brief approves it for التفسير, and its
   * server carries 28 commentary editions plus علوم القرآن — asbāb al-nuzūl,
   * qirāʾāt, iʿrāb, root concordance.
   */
  "tafsir-center": {
    endpoint: "https://mcp.tafsir.net/mcp",
    publisher: "مركز تفسير",
  },
};

export const publisherOf = (id: McpServerId) => SERVERS[id].publisher;

/**
 * How long one tool call may take.
 *
 * Matches the direct adapters' budget and for the same reason: these calls sit
 * inside an agentic loop that may make several before writing a word, so a slow
 * source costs the reader directly. Longer than the REST timeout because an MCP
 * call includes session setup on a cold connection.
 */
const TIMEOUT_MS = 12_000;

/**
 * Live connections, one per server per process.
 *
 * MCP is session-oriented: a connection carries an initialised session, so
 * reconnecting per call would pay the handshake every time. The cache holds the
 * *promise* rather than the client so that concurrent first calls — which is
 * the normal case, since the tools run in parallel — share one handshake
 * instead of racing to open several sessions.
 */
const pool = new Map<McpServerId, Promise<Client>>();

const open = async (id: McpServerId): Promise<Client> => {
  const { endpoint } = SERVERS[id];
  const client = new Client(
    { name: "rfeeq", version: "1.0.0" },
    // This client reads; it exposes no roots and no sampling callback, so a
    // server cannot ask it to run a model or walk a filesystem.
    { capabilities: {} },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
  return client;
};

const connect = (id: McpServerId): Promise<Client> => {
  const existing = pool.get(id);
  if (existing) return existing;

  const pending = open(id).catch((error: unknown) => {
    // A failed handshake must not be cached, or one network blip would disable
    // the source for the lifetime of the process.
    pool.delete(id);
    throw error;
  });
  pool.set(id, pending);
  return pending;
};

/** Drops a connection so the next call re-handshakes. */
const reset = async (id: McpServerId) => {
  const existing = pool.get(id);
  pool.delete(id);
  if (!existing) return;
  try {
    await (await existing).close();
  } catch {
    // Already broken — which is why we are resetting it.
  }
};

export interface McpToolResult {
  /** The server's structured payload, when the tool declares an output schema. */
  structuredContent?: Record<string, unknown>;
  /** Every text part the server sent, in order. */
  texts: string[];
  /** The text parts joined, for tools that answer with a single document. */
  text?: string;
}

/**
 * Reads a tool result from both channels the protocol offers.
 *
 * Which channel carries the answer is per tool, not per server, and the two do
 * not always agree in shape. The concordance search is the case that matters:
 * it returns **one text part per hit** and the whole result set in
 * `structuredContent`, so reading the first text part alone yields one verse
 * while looking like an empty result to a parser expecting the array. Every
 * text part is kept for that reason, and callers that have a structured payload
 * available prefer it.
 */
const readResult = (raw: unknown): McpToolResult => {
  const result = raw as {
    structuredContent?: Record<string, unknown>;
    content?: { type?: string; text?: string }[];
  };

  const texts = (result.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .filter((text): text is string => typeof text === "string");

  return {
    ...(result.structuredContent && {
      structuredContent: result.structuredContent,
    }),
    texts,
    ...(texts.length > 0 && { text: texts.join("\n") }),
  };
};

/**
 * Calls one tool on one approved server.
 *
 * Retries once on a dropped session and no further. A session can expire
 * between questions, which is a transport fault and worth retrying
 * transparently; anything that fails twice is reported as the source being
 * unavailable, because an answer that says what it could not reach is what
 * criterion 4 asks for and is better than one that waits.
 */
export const callMcpTool = async (
  id: McpServerId,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> => {
  const attempt = async () => {
    const client = await connect(id);
    return readResult(
      await client.callTool({ name, arguments: args }, undefined, {
        timeout: TIMEOUT_MS,
      }),
    );
  };

  try {
    return await attempt();
  } catch (first) {
    await reset(id);
    try {
      return await attempt();
    } catch (second) {
      throw new SourceUnavailableError(SERVERS[id].publisher, second ?? first);
    }
  }
};
