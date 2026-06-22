# Zitting HQ MCP server

A remote [MCP](https://modelcontextprotocol.io) server that connects the household's finance data to Claude (or any MCP client). It reuses the app's own data layer — reads via `getFinanceData()`, writes via `src/db/mutations.ts` — at **owner scope** (the whole household; no per-member scrubbing).

- **Endpoint:** `https://zitting-hq.vercel.app/api/mcp` (Streamable HTTP). Local dev: `http://localhost:3000/api/mcp`.
- **Entry point:** `src/app/api/[transport]/route.ts` (auth + handler). Tools live here in `src/mcp/`:
  - `helpers.ts` — `ok/fail/tool/writeResult/requireConfirm` + shared zod shapes
  - `snapshot.ts` — pure section-selection for `financial_snapshot`
  - `register.ts` — `registerAllTools(server, tier)`
  - `tools/*.ts` — one registrar per domain (reads, transactions, categories, budgets, transfers, income, allowances, savings, accounts, settings, imports)

## Auth (two tokens, two tiers)

Set in Vercel env (and `.env.example`). Pass either as `Authorization: Bearer <token>` **or** `?key=<token>`:

| Env var | Tier | Capability |
| --- | --- | --- |
| `MCP_TOKEN` | `full` | All read tools **+ all write tools** (incl. irreversible ops) |
| `MCP_READONLY_TOKEN` | `readonly` | Read tools only — write tools aren't even registered |

The token is the **only** boundary and grants **full owner authority** over the entire household's finances. If neither is set, the endpoint returns `503`. Wrong token → `401`. `/api/mcp` is in `proxy.ts` `PUBLIC_PATHS` (it gates itself, bypassing session auth by design).

**Rotation:** set a new value in Vercel env → redeploy → update the connector. Treat both tokens as secrets.

## Guardrails

- **Destructive tools require `confirm: true`** (e.g. `delete_account`, `remove_member`, `delete_category`, `delete_import`, `rebuild_merchant_memory`, `mark_income_source` — which relabels past deposits). Without it they refuse with an explanatory error.
- **Dry runs:** `delete_account` / `delete_category` accept `dryRun: true` to report blast radius; `dedupe_transactions` defaults to a dry run (`apply: false`).
- **`remove_member`** detaches transactions and deletes the member row but does **not** delete the Supabase auth login — clean that up separately.

## Reads & the snapshot

`financial_snapshot` returns the whole owner dataset: omit `sections` for a compact summary, pass specific `sections`, or `sections:['all']` for everything except the large arrays (transactions/receipts/notifications/account-transfers/income-history — use the dedicated `list_*` tools, or `includeTxns:true` to add transactions).

## Known limitation

MCP writes call mutations directly and do **not** `revalidatePath("/finance")`, so the web UI may show stale data until its own revalidation (navigation/TTL). The data itself is correct immediately.

## Excluded (use the web UI)

Plaid bank linking (interactive OAuth), CSV import commit (needs an uploaded file), and device push subscriptions. `sync_now` (re-pull connected banks) **is** available.
