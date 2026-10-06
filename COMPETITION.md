# Rfeeq — competition instance

A clone of the stg app, retargeted for **تحدي الذكاء الاصطناعي في خدمة المحتوى
الإسلامي** and served at **comp.rfeeq.ai**. The brief, the approved-source
allow-list and the published test cases are in [`docs/competition/`](docs/competition/).

This directory is **separate from the live app** at `/home/ubuntu/app/qaf/agentset`
(stg.rfeeq.ai). Nothing here writes to that instance's database.

## What differs from stg

| | stg | competition |
| --- | --- | --- |
| Directory | `/home/ubuntu/app/qaf/agentset` | `/home/ubuntu/app/comp/agentset` |
| Origin | `https://stg.rfeeq.ai` | `https://comp.rfeeq.ai` |
| Port | 3000 | **3001** |
| Database | `agentset` on :5433 | **`agentset_comp`** on :5433 |
| Session secret | its own | **its own** — a stg cookie is not valid here |
| Qdrant | `as_<namespaceId>` | same server; new corpora get new namespace ids, so new collections |

Everything else — API keys, SMTP, S3, the default organisation — is shared with
stg, because those are account-level credentials rather than per-instance state.

> **Qdrant is shared.** The competition app can *read* the existing collections.
> Do not run ingestion against a namespace carried over from the stg snapshot:
> both apps point at the same vectors, so a re-ingest there would be visible in
> the live app. Competition corpora should be created as **new** namespaces.

## Running it

```bash
cd /home/ubuntu/app/comp/agentset
bun install
bun db:migrate          # against agentset_comp — check DATABASE_URL first
bun dev:web             # serves on :3001 via PORT in .env
```

`bun db:generate` regenerates the Prisma client — **restart the dev server
afterwards**, or it keeps the old client in memory and rejects columns the
schema clearly has.

Both instances can run at once; they share only Postgres (different databases)
and the Qdrant server.

## Deployment

**Live at https://comp.rfeeq.ai** since 2026-10-05.

| Piece | State |
| --- | --- |
| DNS | A record `comp.rfeeq.ai` → `44.209.203.198`, TTL 60 (Route 53; rfeeq.ai has no wildcard, so each subdomain is explicit) |
| Caddy vhost | appended to `/home/ubuntu/app/sohba/deploy/Caddyfile`, proxying `172.18.0.1:3001` |
| TLS | Let's Encrypt via tls-alpn-01, expires 2027-01-03, auto-renewing |

`deploy/Caddyfile.comp` is the copy of the applied block, kept here so the vhost
travels with the repo.

> Edit that Caddyfile **in place** — never with `sed -i`. It is bind-mounted into
> the `adkar-caddy` container, and `sed -i` writes a new inode, so the container
> keeps serving the old config while `caddy reload` reports success. Append or
> edit in place, confirm `stat -c %i` is unchanged, then reload:
>
> ```bash
> docker exec adkar-caddy caddy validate --config /etc/caddy/Caddyfile
> docker exec -w /etc/caddy adkar-caddy caddy reload --config /etc/caddy/Caddyfile
> ```
>
> Reload is correct when the inode is unchanged and leaves the other five vhosts
> untouched. `docker restart adkar-caddy` is the fallback if the inode moved.
