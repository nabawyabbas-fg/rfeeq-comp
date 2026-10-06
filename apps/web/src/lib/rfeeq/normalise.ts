/**
 * Arabic normalisation, for matching only.
 *
 * Strips tashkīl and tatwīl and folds the alif, yāʾ and tāʾ-marbūṭa variants,
 * so «مَا حُكْمُ» and «ما حكم» are one pattern and «إذا» matches «اذا».
 *
 * **Never use the result as display text** — it destroys the orthography it
 * normalises, which for a Qurʾānic verse is the whole of what makes it
 * canonical.
 *
 * Lives on its own because three modules now match against normalised Arabic —
 * the intent router, the terminology dictionary, and the template sections —
 * and a fourth copy of these six lines would eventually drift from the others.
 * That drift is not hypothetical: every pattern in the system is written in the
 * form this function produces, so a module folding «ة» differently from its
 * neighbour would silently stop matching while looking correct.
 */
export const normalise = (text: string) =>
  text
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[آأإا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The clitic cluster Arabic puts in front of a noun.
 *
 * Built compositionally rather than enumerated — an optional conjunction, then
 * an optional preposition, then an optional article — so «السنة» and «بالسنة»
 * and «وبالسنة» and «للسنة» all reach the same stem. A flat list of prefixes
 * missed «وبال», which is two clitics stacked and perfectly ordinary.
 *
 * Terms matched through this are therefore written as **bare stems**: spelling
 * one with «ال» and prefixing an article here would ask for «والالسنة».
 */
export const CLITIC = "(?:[وف]?(?:لل|[بكل]?(?:ال)?))";

/**
 * A matcher for Arabic stems, with Unicode-aware boundaries.
 *
 * `\b` is unusable: JavaScript defines it over `[A-Za-z0-9_]`, so between a
 * space and an Arabic letter there is no boundary at all and `/\bحديث\b/`
 * matches nothing — a defect that silently disabled every pattern in the intent
 * router once already.
 *
 * `whole` adds a right boundary too. Use it where a following letter changes
 * the word: a dictionary headword wants it, since «السنين» is not «السنة»;
 * a topical pattern usually does not, since Arabic suffixes there are
 * inflection rather than a change of sense.
 *
 * Terms are folded through `normalise` on the way in, so write them the way
 * Arabic spells them.
 */
export const stems = (terms: string[], { whole = false } = {}) =>
  new RegExp(
    `(?<![\\p{L}\\p{M}])${CLITIC}(?:${terms.map(normalise).join("|")})` +
      (whole ? "(?![\\p{L}\\p{M}])" : ""),
    "u",
  );
