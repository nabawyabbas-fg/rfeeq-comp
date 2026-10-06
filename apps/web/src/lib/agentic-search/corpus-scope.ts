import "server-only";

import { db } from "@agentset/db/client";
import { normalizeArabicName } from "@agentset/utils";

/**
 * Turns a source named in a question into the book ids retrieval filters on.
 *
 * A reader who asks "من كتاب لسان العرب فقط" or "من مؤلفات ابن القيم" is
 * naming metadata, not content. Without this the model folds the name into the
 * query text, which retrieves passages *mentioning* the work rather than
 * passages *from* it — observed returning zero chunks from لسان العرب across
 * fourteen searches while answering confidently from other books.
 *
 * Resolution is reported back rather than applied silently: "لسان العرب"
 * matches five works, and "ابن القيم" matches both the author (74 works) and
 * his son برهان الدين (2). Picking one quietly is how a scoped answer comes
 * back authoritative and wrong.
 */
export interface ResolvedScope {
  kind: "book" | "author";
  /** Shown to the reader, e.g. `ابن القيم — 74 works`. */
  label: string;
  bookIds: number[];
}

export interface AmbiguousScope {
  kind: "ambiguous";
  requested: string;
  candidates: { label: string; bookIds: number[] }[];
}

export interface UnresolvedScope {
  kind: "unresolved";
  requested: string;
}

export type ScopeResult = ResolvedScope | AmbiguousScope | UnresolvedScope;

/** How many near-matches to offer back before it stops being a useful list. */
const MAX_CANDIDATES = 5;

const bookLabel = (b: { title: string; pageCount: number | null }) =>
  b.pageCount ? `${b.title} — ${b.pageCount.toLocaleString()} pages` : b.title;

const authorLabel = (a: {
  name: string;
  death: number | null;
  _count: { books: number };
}) =>
  `${a.name}${a.death ? ` (d. ${a.death})` : ""} — ${a._count.books} work${
    a._count.books === 1 ? "" : "s"
  }`;

/**
 * Exact normalised match first, then contains.
 *
 * Exact is what disambiguates: `لسان العرب` is also a substring of
 * `ارتشاف الضرب من لسان العرب` and `خزانة الأدب ولب لباب لسان العرب`, which are
 * different works. When the reader names a title exactly, that is the answer —
 * falling straight to substring would bury it among four others.
 */
export const resolveBookScope = async (
  requested: string,
): Promise<ScopeResult> => {
  const needle = normalizeArabicName(requested);
  if (!needle) return { kind: "unresolved", requested };

  const exact = await db.corpusBook.findMany({
    where: { titleNormalized: needle },
    select: { id: true, title: true, pageCount: true },
    take: MAX_CANDIDATES + 1,
  });
  const rows = exact.length
    ? exact
    : await db.corpusBook.findMany({
        where: { titleNormalized: { contains: needle } },
        select: { id: true, title: true, pageCount: true },
        orderBy: { pageCount: "desc" },
        take: MAX_CANDIDATES + 1,
      });

  if (rows.length === 0) return { kind: "unresolved", requested };
  if (rows.length === 1) {
    return { kind: "book", label: bookLabel(rows[0]!), bookIds: [rows[0]!.id] };
  }
  return {
    kind: "ambiguous",
    requested,
    candidates: rows.slice(0, MAX_CANDIDATES).map((b) => ({
      label: bookLabel(b),
      bookIds: [b.id],
    })),
  };
};

export const resolveAuthorScope = async (
  requested: string,
): Promise<ScopeResult> => {
  const needle = normalizeArabicName(requested);
  if (!needle) return { kind: "unresolved", requested };

  const select = {
    id: true,
    name: true,
    death: true,
    books: { select: { id: true } },
    _count: { select: { books: true } },
  } as const;

  const exact = await db.corpusAuthor.findMany({
    where: { nameNormalized: needle },
    select,
    take: MAX_CANDIDATES + 1,
  });
  const rows = exact.length
    ? exact
    : await db.corpusAuthor.findMany({
        where: { nameNormalized: { contains: needle } },
        select,
        orderBy: { books: { _count: "desc" } },
        take: MAX_CANDIDATES + 1,
      });

  const withBooks = rows.filter((a) => a.books.length > 0);
  if (withBooks.length === 0) return { kind: "unresolved", requested };
  if (withBooks.length === 1) {
    const a = withBooks[0]!;
    return {
      kind: "author",
      label: authorLabel(a),
      bookIds: a.books.map((b) => b.id),
    };
  }
  return {
    kind: "ambiguous",
    requested,
    candidates: withBooks.slice(0, MAX_CANDIDATES).map((a) => ({
      label: authorLabel(a),
      bookIds: a.books.map((b) => b.id),
    })),
  };
};
