---
name: ship
description: Run the full Zitting HQ ship gate (typecheck, tests, build), then commit and push. Use when a feature or fix is complete and ready to deploy.
disable-model-invocation: true
---

# ship

The close-out ritual for a finished change. Runs the three gates, commits with
the house trailer, pushes, and confirms the Vercel deploy. Stop and report at
the first failure — never push red.

## 1. Gates (in order, stop on failure)

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

- `tsc` is project-wide and catches what the per-edit test hook can't (type
  errors, missing props, redeclarations).
- If another concurrent tab left an unrelated failure (e.g. a stray
  `*.test.ts`), say so explicitly — don't silently absorb it, and don't "fix"
  files you didn't touch without flagging it.

## 2. Browser QA (when UI changed)

The dev server runs on **port 3002**. For member-facing changes, QA the member
experience via `/dev-preview` → "View as member" using the chrome-devtools MCP,
and check `list_console_messages` for errors. Screenshots go in `.gstack/`
(already gitignored-ish; never commit leaked financial numbers — see below).

## 3. Commit

- Branch first if on `main` and the change is non-trivial; otherwise commit to
  the current branch.
- Write a real message: what changed and **why**, not just what.
- End the commit body with exactly:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- **Never commit real financial figures**, account numbers, or the QA
  screenshots if they show live balances. Keep dollar amounts out of commit
  messages and chat.

```bash
git add -A
git commit -m "$(cat <<'EOF'
<summary line>

<what + why>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push origin <branch>
```

## 4. Confirm the deploy

Vercel rebuilds on push. Give it ~60s, then:
```bash
vercel ls 2>&1 | grep "zitting-" | head -1
```
Report the deployment URL and that it reached **● Ready** (a Building/Error
state means stop and investigate).

## 5. Pending hand-offs

If the change shipped a `supabase-*.sql` migration or needs a new Vercel env
var, end by reminding Jared in one line what he still has to run/set — the code
degrades gracefully without it, but the feature isn't fully live until it's done.
