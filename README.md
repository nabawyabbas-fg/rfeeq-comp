<h1 align="center">رفيق · Rfeeq</h1>

<p align="center">
  <strong>Answers about Islamic scholarship, traceable to the sources they rest on.</strong>
</p>

Rfeeq answers from published, named sources rather than from a model's memory.
Every claim carries a citation to the passage it came from; where the sources
disagree the answer says so instead of picking a side; and where a question asks
for something the system is not entitled to give — a ruling on someone's own
situation, a judgement on a named person — it says that too, rather than
answering anyway.

It reads the Qurʾān and its commentaries, the hadith encyclopedias with the
muḥaddiths' own gradings, the fiqh encyclopedias, and a terminology dictionary —
each through the publisher's own interface, so a citation points at a real page
somebody can open.

---

## What it does

**Two axes decide every answer.** _Intent_ chooses which body of material may
answer — a question about a verse does not get a fiqh encyclopedia. _Level_
chooses what may be asserted once the material is in hand: reporting a ruling a
source states is not the same speech act as issuing one for the asker, and the
system does the first and refuses the second.

**Answers are typed, not free prose.** Each kind of question renders to a named
set of sections — a verse answer leads with the āya, a hadith answer with its
grading — and the verse text, the grading and the reference line are rendered
from the retrieved passage rather than retyped by the model, so they cannot
drift from what the source says.

**Proofs stand under the claims they prove.** A ruling's evidence is written
beside the point it establishes, ordered قرآن ← سنة ← إجماع ← قياس.

**The sources are a tap away.** A sūra name opens مقدمات السورة; an āya mark
opens علوم الآية — asbāb al-nuzūl, six tafsīrs, iʿrāb, tajwīd, qirāʾāt; a word
opens علوم الكلمة; a hadith opens تفاصيل الحديث with every muḥaddith's ruling on
it, each with its book and page.

---

## Requirements

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Bun**        | 1.3.6 or later — the package manager and the runtime |
| **Node**       | 22.12 or later                                       |
| **PostgreSQL** | 14 or later, one empty database                      |

Model access: a **Google AI** key (the answering model is Gemini) and an
**OpenAI** key (the domain-locked web search, the opening suggestions, the
follow-up questions). Both are needed for the product to work end to end.

---

## Install

```bash
bun install
cp .env.example .env     # then fill it in — see below
bun db:migrate           # create the schema
bun dev:web              # http://localhost:3000
```

`bun db:migrate` applies the migrations and generates the Prisma client. If you
add a column or an enum value later, run it again **and restart the dev
server** — Fast Refresh keeps the old client in memory, so a schema change the
files clearly contain is rejected at runtime until the process restarts.

### One row you have to create yourself

Every account is attached to an organisation, and signup fails without one. Make
it once, then put its id in `DEFAULT_ORGANIZATION_ID`:

```bash
bun db:studio            # create a row in `organization`, copy its id
```

---

## Environment

`.env.example` lists every variable with a note on what stops working without
it. The schema in `apps/web/src/env.ts` validates at startup, so a missing
required key fails the boot with a message naming it rather than surfacing later
as a broken request.

The ones that matter most:

| Variable                                     | What it is for                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`                 | Postgres. `DIRECT_URL` is the unpooled connection migrations run over.                                                                        |
| `BETTER_AUTH_SECRET`                         | Session signing key — `openssl rand -base64 32`.                                                                                              |
| `BETTER_AUTH_URL`                            | The origin the app is reached at. Must match the browser's address bar.                                                                       |
| `NEXT_PUBLIC_APP_ORIGIN`                     | The same origin, scheme included. Behind a TLS-terminating proxy the app would otherwise assemble `http://` + host and redirect out of https. |
| `DEFAULT_ORGANIZATION_ID`                    | The organisation new accounts join.                                                                                                           |
| `GOOGLE_API_KEY`                             | The answering model (`google:gemini-3.7-flash`).                                                                                              |
| `OPENAI_API_KEY`                             | The domain-locked web search, the opening suggestions, the follow-ups.                                                                        |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`   | Sign in with Google. Optional — see below.                                                                                                    |
| `EMAIL_TRANSPORT` + SMTP or `RESEND_API_KEY` | Verification codes and sign-in links.                                                                                                         |

Everything else — Redis, S3, Stripe — is optional. Without Redis the rate
limiter is a no-op, which is fine locally and not in public.

---

## Signing in with Google

The Google button only appears when both credentials are set; an unconfigured
provider is omitted rather than rendered as a button that fails on redirect. So
you can skip this entirely and use email sign-in.

To enable it:

**1. Create a project** at [console.cloud.google.com](https://console.cloud.google.com/)
— or reuse one.

**2. Configure the consent screen.** _APIs & Services → OAuth consent screen_.
Choose **External** unless everyone signing in is inside your Google Workspace.
Fill in the app name, a support email and a developer email. The scopes you need
are the default `email`, `profile` and `openid` — nothing further, because the
app reads a name and an email address and nothing else.

While the consent screen is in **Testing**, only accounts listed under _Test
users_ can sign in; everybody else is refused with a message that reads like a
bug. Add your own address there, and publish the app when you want it open.

**3. Create the credentials.** _APIs & Services → Credentials → Create
credentials → OAuth client ID → Web application_.

Add an **Authorised redirect URI** — this is the one that is easy to get wrong,
and a mismatch is rejected by Google with `redirect_uri_mismatch` before your
app is ever reached:

```
http://localhost:3000/api/auth/callback/google
```

For a deployment, the same path on the real origin:

```
https://your-domain/api/auth/callback/google
```

The host and scheme must match `BETTER_AUTH_URL` exactly. `http` and `https`,
and `localhost` and `127.0.0.1`, are different origins to Google.

Add the origin itself under **Authorised JavaScript origins**
(`http://localhost:3000`).

**4. Copy the two values** into `.env`:

```
GOOGLE_CLIENT_ID=…apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=…
```

Restart the dev server — the provider list is read at startup, so a key added to
a running process has no effect.

> The `GOOGLE_CLIENT_ID` for sign-in and the `GOOGLE_API_KEY` for the model are
> unrelated credentials from different consoles. They are easy to confuse
> because both say "Google"; one is OAuth, the other is an AI Studio key.

---

## Email

Verification codes and sign-in links go out over whichever transport is
configured. Set `EMAIL_TRANSPORT=smtp` with the four `SMTP_*` values, or
`EMAIL_TRANSPORT=resend` with `RESEND_API_KEY`.

`EMAIL_FROM` overrides the sender for every message. A relay only accepts a
sender it holds a verified identity for, so a sender on an unverified domain is
rejected at `MAIL FROM` whatever the templates say.

With neither configured, email sign-in cannot complete — use Google, or add a
transport.

---

## Commands

```bash
bun dev:web          # the app, with hot reload
bun dev              # every workspace in watch mode
bun typecheck        # TypeScript across the monorepo
bun lint             # ESLint
bun test             # the test suite (run from apps/web)
bun db:migrate       # apply migrations, regenerate the client
bun db:studio        # browse the database
bun build            # production build
```

---

## How it is laid out

```
apps/web                     the application
  src/lib/rfeeq              intent routing, answer templates, prompts, sources
    sources/                 the publishers' interfaces and the allow-list
    sources/mcp/             the two publisher servers
  src/components/rfeeq       the reader-facing surface
  src/app/(rfeeq)            the routes: /, /c/<id>, /settings
packages/db                  Prisma schema and migrations
packages/emails              transactional email
packages/engine              retrieval, embeddings, vector stores
```

The pieces worth knowing first:

- **`lib/rfeeq/intent.ts`** decides intent and level, and refuses the four
  things that are out of scope.
- **`lib/rfeeq/templates.ts`** is the answer contract — which sections exist per
  kind of question, in what order, folded or open.
- **`lib/rfeeq/sources/allowlist.ts`** is the retrieval allow-list, enforced at
  the socket. A passage from a host that is not on it never becomes a citation.

---

## Licence

MIT. See [`LICENSE.md`](./LICENSE.md) — the notice stays in copies, which is
what the licence asks for.
