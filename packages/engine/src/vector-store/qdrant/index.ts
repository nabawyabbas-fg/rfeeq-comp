import { QdrantClient } from "@qdrant/js-client-rest";

import { makeChunk } from "../../chunk";
import type {
  VectorStoreMetadata,
  VectorStoreOrderedQueryOptions,
  VectorStoreQueryOptions,
  VectorStoreQueryResponse,
  VectorStoreUpsertOptions,
} from "../common/vector-store";
import { VectorStore } from "../common/vector-store";
import { toPointId, toSparseVector } from "./arabic";
import type { QdrantClause, QdrantFilter, QdrantVectorFilter } from "./filter";
import { QdrantFilterTranslator } from "./filter";

/**
 * The generated client types express filters as a very wide union that our
 * narrow, validated filter tree does not structurally satisfy. The translator is
 * the thing that guarantees shape correctness, so we convert once, here, rather
 * than casting at every call site.
 */
type ClientFilter = NonNullable<
  NonNullable<Parameters<QdrantClient["scroll"]>[1]>["filter"]
>;

const asClientFilter = (filter?: QdrantFilter): ClientFilter | undefined =>
  filter as unknown as ClientFilter | undefined;

/** Named vectors, so dense and keyword search share one point. */
const DENSE = "dense";
const KEYWORD = "keyword";

/** Payload keys we own. Everything else in the payload is chunk metadata. */
const ID_KEY = "_id";
const TEXT_KEY = "text";
const TENANT_KEY = "_tenant";

const isNotFound = (error: unknown): boolean => {
  const status = (error as { status?: number })?.status;
  const message = String((error as Error)?.message ?? "");
  return status === 404 || /not found|doesn't exist|does not exist/i.test(message);
};

export class Qdrant extends VectorStore<QdrantVectorFilter> {
  private readonly client: QdrantClient;
  private readonly collection: string;
  private readonly tenantId?: string;
  private readonly filterTranslator = new QdrantFilterTranslator();

  /** Payload fields we have already indexed for ordered queries. */
  private readonly orderedIndexes = new Set<string>();
  private ensuring?: Promise<void>;

  constructor({
    url,
    apiKey,
    namespaceId,
    tenantId,
  }: {
    url: string;
    apiKey?: string;
    namespaceId: string;
    tenantId?: string;
  }) {
    super();
    this.client = new QdrantClient({ url, apiKey, checkCompatibility: false });
    // One collection per namespace: namespaces may use different embedding
    // models, and a Qdrant collection has a fixed vector size. Tenants inside a
    // namespace share the model, so they are separated by payload instead —
    // which is what Qdrant recommends over a collection per tenant.
    this.collection = `as_${namespaceId}`;
    this.tenantId = tenantId;
  }

  /**
   * Creates the collection on first write, sized from the vector we were handed.
   * The embedding model is chosen per namespace and not known to the store until
   * then, so there is nothing to create at construction time.
   */
  private async ensureCollection(dimensions: number): Promise<void> {
    this.ensuring ??= (async () => {
      const { exists } = await this.client.collectionExists(this.collection);
      if (exists) return;

      try {
        await this.client.createCollection(this.collection, {
          vectors: { [DENSE]: { size: dimensions, distance: "Cosine" } },
          // `idf` has Qdrant apply inverse document frequency against the live
          // corpus at query time, so we can send plain term frequencies.
          sparse_vectors: { [KEYWORD]: { modifier: "idf" } },
        });

        await this.client.createPayloadIndex(this.collection, {
          field_name: TENANT_KEY,
          field_schema: { type: "keyword", is_tenant: true },
        });
      } catch (error) {
        // A concurrent writer may have won the race; that is fine.
        if (!/already exists/i.test(String((error as Error)?.message))) throw error;
      }
    })();

    try {
      await this.ensuring;
    } catch (error) {
      this.ensuring = undefined; // let the next write retry
      throw error;
    }
  }

  /**
   * Scopes every read and write to the current tenant.
   *
   * With no tenant set this restricts to rows that carry no tenant at all,
   * rather than matching everything. That mirrors the Turbopuffer adapter, where
   * a tenant lives in its own namespace and is therefore invisible to the
   * untenanted store — and it matters, because the playground and hosting routes
   * build the store *without* a tenant. Matching everything there would surface
   * one tenant's documents on another's site.
   */
  private withTenant(
    filter: QdrantFilter | undefined,
  ): QdrantFilter | undefined {
    const scope: QdrantClause = this.tenantId
      ? { key: TENANT_KEY, match: { value: this.tenantId } }
      : { is_empty: { key: TENANT_KEY } };

    return {
      must: [...(filter?.must ?? []), scope],
      ...(filter?.should ? { should: filter.should } : {}),
      ...(filter?.must_not ? { must_not: filter.must_not } : {}),
    };
  }

  private buildFilter(
    filter: QdrantVectorFilter | undefined,
    id?: string,
  ): QdrantFilter | undefined {
    const translated = this.filterTranslator.translate(filter);
    const withId = id
      ? {
          must: [
            ...(translated?.must ?? []),
            { key: ID_KEY, match: { value: id } },
          ],
        }
      : translated;
    return this.withTenant(withId);
  }

  /** Splits a Qdrant payload back into the shape the platform expects. */
  private toResult(
    point: { id: string | number; score?: number; payload?: Record<string, unknown> | null },
    includeMetadata?: boolean,
  ) {
    const payload = point.payload ?? {};
    const {
      [ID_KEY]: originalId,
      [TEXT_KEY]: text,
      [TENANT_KEY]: _tenant,
      ...metadata
    } = payload;

    return {
      id: (originalId as string | undefined) ?? String(point.id),
      score: point.score,
      text: (text as string) ?? "",
      metadata: includeMetadata ? (metadata as VectorStoreMetadata) : undefined,
    };
  }

  async query(
    params: VectorStoreQueryOptions<QdrantVectorFilter>,
  ): Promise<VectorStoreQueryResponse> {
    const filter = this.buildFilter(params.filter, params.id);

    const common = {
      limit: params.topK,
      filter: asClientFilter(filter),
      with_payload: true as const,
    };

    try {
      if (params.mode.type === "semantic") {
        const { points } = await this.client.query(this.collection, {
          ...common,
          query: params.mode.vector,
          using: DENSE,
          ...(typeof params.minScore === "number"
            ? { score_threshold: params.minScore }
            : {}),
        });
        return points.map((p) => this.toResult(p, params.includeMetadata));
      }

      if (params.mode.type === "keyword") {
        const { points } = await this.client.query(this.collection, {
          ...common,
          query: toSparseVector(params.mode.text),
          using: KEYWORD,
        });
        return points.map((p) => this.toResult(p, params.includeMetadata));
      }

      // Hybrid: run both retrievers and let Qdrant fuse them with Reciprocal
      // Rank Fusion. Dense alone misses exact terms — names, ḥadīth fragments,
      // technical vocabulary — which is precisely what readers search for.
      const { points } = await this.client.query(this.collection, {
        prefetch: [
          {
            query: params.mode.vector,
            using: DENSE,
            limit: params.topK,
            filter: asClientFilter(filter),
          },
          {
            query: toSparseVector(params.mode.text),
            using: KEYWORD,
            limit: params.topK,
            filter: asClientFilter(filter),
          },
        ],
        query: { fusion: "rrf" },
        limit: params.topK,
        with_payload: true,
      });

      return points.map((p) => this.toResult(p, params.includeMetadata));
    } catch (error) {
      // Nothing has been written to this namespace yet.
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async queryOrdered(
    params: VectorStoreOrderedQueryOptions<QdrantVectorFilter>,
  ): Promise<VectorStoreQueryResponse> {
    const attribute = params.orderBy.attribute;

    try {
      // Qdrant can only order by an indexed payload field, and which field the
      // caller wants is not known until now.
      if (!this.orderedIndexes.has(attribute)) {
        try {
          await this.client.createPayloadIndex(this.collection, {
            field_name: attribute,
            field_schema: "integer",
          });
        } catch (error) {
          if (!/already exists/i.test(String((error as Error)?.message))) throw error;
        }
        this.orderedIndexes.add(attribute);
      }

      const { points } = await this.client.scroll(this.collection, {
        filter: asClientFilter(this.buildFilter(params.filter)),
        limit: params.topK,
        with_payload: true,
        order_by: { key: attribute, direction: params.orderBy.direction },
      });

      return points.map((p) => this.toResult(p, params.includeMetadata));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async upsert({ chunks }: VectorStoreUpsertOptions): Promise<void> {
    if (!chunks.length) return;

    const nodes = chunks.map((chunk) =>
      makeChunk(chunk, { removeTextFromMetadata: true }),
    );

    const dimensions = nodes[0]!.vector.length;
    await this.ensureCollection(dimensions);

    await this.client.upsert(this.collection, {
      wait: true,
      points: nodes.map((node) => ({
        id: toPointId(node.id),
        vector: {
          [DENSE]: node.vector,
          [KEYWORD]: toSparseVector(node.text),
        },
        payload: {
          [ID_KEY]: node.id,
          [TEXT_KEY]: node.text,
          ...(this.tenantId ? { [TENANT_KEY]: this.tenantId } : {}),
          ...node.metadata,
        },
      })),
    });
  }

  async deleteByIds(idOrIds: string | string[]): Promise<{ deleted?: number }> {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (!ids.length) return { deleted: 0 };

    try {
      await this.client.delete(this.collection, {
        wait: true,
        points: ids.map(toPointId),
      });
      return { deleted: ids.length };
    } catch (error) {
      if (isNotFound(error)) return {};
      throw error;
    }
  }

  async deleteByFilter(
    filter: QdrantVectorFilter,
  ): Promise<{ deleted?: number }> {
    try {
      const scoped = this.buildFilter(filter);
      await this.client.delete(this.collection, {
        wait: true,
        filter: asClientFilter(scoped) ?? {},
      });
      return {};
    } catch (error) {
      if (isNotFound(error)) return {};
      throw error;
    }
  }

  async deleteNamespace(): Promise<{ deleted?: number }> {
    try {
      // A tenant owns a slice of the collection, not the collection itself —
      // dropping it would take every other tenant with it.
      if (this.tenantId) {
        await this.client.delete(this.collection, {
          wait: true,
          filter: asClientFilter(this.withTenant(undefined)) ?? {},
        });
        return {};
      }

      // Untenanted teardown means the namespace itself is going away, so the
      // whole collection goes — including any tenants inside it.
      await this.client.deleteCollection(this.collection);
      return {};
    } catch (error) {
      if (isNotFound(error)) return {};
      throw error;
    }
  }

  /**
   * Collections are created lazily at the embedding model's size, so any
   * dimension is acceptable. This doubles as the reachability check the
   * namespace validator relies on.
   */
  async getDimensions(): Promise<number | "ANY"> {
    await this.client.getCollections();
    return "ANY";
  }

  async warmCache(): Promise<"UNSUPPORTED" | void> {
    return "UNSUPPORTED";
  }

  supportsKeyword(): boolean {
    return true;
  }

  supportsOrderedQuery(): boolean {
    return true;
  }
}
