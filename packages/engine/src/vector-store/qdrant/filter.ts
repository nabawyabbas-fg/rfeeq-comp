import type {
  BlacklistedRootOperators,
  LogicalOperatorValueMap,
  OperatorSupport,
  OperatorValueMap,
  VectorFilter,
} from "../common/filter";
import { BaseFilterTranslator } from "../common/filter";

/** Qdrant's filter shape — see https://qdrant.tech/documentation/concepts/filtering/ */
export interface QdrantFieldCondition {
  key: string;
  match?: { value?: unknown; any?: unknown[]; except?: unknown[] };
  range?: { gt?: number; gte?: number; lt?: number; lte?: number };
}

export interface QdrantIsEmptyCondition {
  is_empty: { key: string };
}

export type QdrantCondition = QdrantFieldCondition | QdrantIsEmptyCondition;

export interface QdrantFilter {
  must?: QdrantClause[];
  should?: QdrantClause[];
  must_not?: QdrantClause[];
}

export type QdrantClause = QdrantCondition | QdrantFilter;

type QdrantOperatorValueMap = Omit<
  OperatorValueMap,
  "$regex" | "$options" | "$elemMatch" | "$all"
>;

type QdrantLogicalOperatorValueMap = Omit<LogicalOperatorValueMap, "$nor">;

type QdrantBlacklistedRootOperators = BlacklistedRootOperators | "$nor";

export type QdrantVectorFilter = VectorFilter<
  keyof QdrantOperatorValueMap,
  QdrantOperatorValueMap,
  QdrantLogicalOperatorValueMap,
  QdrantBlacklistedRootOperators
>;

const RANGE_OPERATORS: Record<string, "gt" | "gte" | "lt" | "lte"> = {
  $gt: "gt",
  $gte: "gte",
  $lt: "lt",
  $lte: "lte",
};

/**
 * Translates the platform's Mongo-style filters into Qdrant's must/should/
 * must_not tree.
 *
 *   { tenantId: "acme", page: { $gte: 10 } }
 *   -> { must: [ {key:"tenantId", match:{value:"acme"}},
 *                {key:"page", range:{gte:10}} ] }
 */
export class QdrantFilterTranslator extends BaseFilterTranslator<
  QdrantVectorFilter,
  QdrantFilter | undefined
> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ["$and", "$or", "$not"],
      array: ["$in", "$nin"],
      element: ["$exists"],
      regex: [],
      custom: [],
    };
  }

  translate(filter?: QdrantVectorFilter): QdrantFilter | undefined {
    if (this.isEmpty(filter)) return undefined;
    this.validateFilter(filter as QdrantVectorFilter);

    const conditions = this.translateNode(
      filter as Record<string, unknown>,
    );
    return conditions.length ? { must: conditions } : undefined;
  }

  /** Translates one filter object into a flat list of ANDed conditions. */
  private translateNode(
    node: Record<string, unknown>,
  ): QdrantClause[] {
    const conditions: QdrantClause[] = [];

    for (const [key, value] of Object.entries(node)) {
      if (key === "$and") {
        const branches = (value as Record<string, unknown>[]).flatMap((b) =>
          this.translateNode(b),
        );
        if (branches.length) conditions.push({ must: branches });
        continue;
      }

      if (key === "$or") {
        const branches = (value as Record<string, unknown>[]).map((b) => ({
          must: this.translateNode(b),
        }));
        if (branches.length) conditions.push({ should: branches });
        continue;
      }

      if (key === "$not") {
        const inner = this.translateNode(value as Record<string, unknown>);
        if (inner.length) conditions.push({ must_not: inner });
        continue;
      }

      conditions.push(...this.translateField(key, value));
    }

    return conditions;
  }

  /** Translates a single `field: condition` pair. */
  private translateField(
    key: string,
    value: unknown,
  ): QdrantClause[] {
    // Bare value is shorthand for equality; arrays mean "any of".
    if (this.isPrimitive(value)) {
      return [{ key, match: { value: this.normalizeComparisonValue(value) } }];
    }

    if (Array.isArray(value)) {
      return [{ key, match: { any: this.normalizeArrayValues(value) } }];
    }

    const conditions: QdrantClause[] = [];
    const range: Record<string, number> = {};

    for (const [operator, operand] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const rangeKey = RANGE_OPERATORS[operator];
      if (rangeKey) {
        range[rangeKey] = this.normalizeComparisonValue(operand) as number;
        continue;
      }

      switch (operator) {
        case "$eq":
          conditions.push({
            key,
            match: { value: this.normalizeComparisonValue(operand) },
          });
          break;
        case "$ne":
          conditions.push({
            must_not: [
              {
                key,
                match: { value: this.normalizeComparisonValue(operand) },
              },
            ],
          });
          break;
        case "$in":
          conditions.push({
            key,
            match: { any: this.normalizeArrayValues(operand as unknown[]) },
          });
          break;
        case "$nin":
          conditions.push({
            key,
            match: { except: this.normalizeArrayValues(operand as unknown[]) },
          });
          break;
        case "$exists":
          conditions.push(
            operand
              ? { must_not: [{ is_empty: { key } }] }
              : { is_empty: { key } },
          );
          break;
        case "$not": {
          const inner = this.translateField(key, operand);
          if (inner.length) conditions.push({ must_not: inner });
          break;
        }
        default:
          throw new Error(
            BaseFilterTranslator.ErrorMessages.UNSUPPORTED_OPERATOR(operator),
          );
      }
    }

    if (Object.keys(range).length) conditions.push({ key, range });

    return conditions;
  }
}
