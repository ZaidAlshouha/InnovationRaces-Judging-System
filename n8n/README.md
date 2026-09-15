# n8n Integration Plan (Future Phase)

n8n is **not** the scoring/evaluation engine — it never calculates scores,
never determines completion, and never computes rankings. All of that stays
inside the application (`lib/scoring/engine.ts`) so the results are always
traceable and testable independent of any external automation tool. n8n's
job is purely: react to events the application already knows about, and
handle communication/export automation the app itself doesn't need to own.

## Planned workflows

| Trigger event | n8n workflow | Notes |
|---|---|---|
| Judge assigned to a project | Send invitation/notification email | Fired from `AssignmentRepository.create` / `createMany` |
| Judge has pending assignments nearing a deadline | Scheduled reminder email | n8n Cron node, reads pending-assignment count via API |
| Judge completes all assigned evaluations | Notify admin | Fired when `assignmentRepository.listByJudge` shows 100% completed |
| All projects reach full completion | Notify admin that rankings are ready to finalize | Fired from the same completion-check the dashboard uses |
| Admin requests a report export | Deliver generated file (email / Slack / Drive) | The app generates the file; n8n only delivers it |

## Event boundary (how the app will call n8n)

Once connected, the application does not embed n8n logic — it makes a
single outbound HTTP call to an n8n webhook URL at well-defined points, e.g.:

```ts
// lib/events/notify.ts (not implemented yet)
async function notifyJudgeAssigned(judgeId: string, projectId: string) {
  if (!process.env.N8N_WEBHOOK_URL) return; // no-op until n8n is connected
  await fetch(`${process.env.N8N_WEBHOOK_URL}/judge-assigned`, {
    method: "POST",
    body: JSON.stringify({ judgeId, projectId }),
  });
}
```

This keeps the event boundary explicit and swappable: the same call sites
can later fire from a Supabase Database Webhook (Postgres trigger → HTTP)
instead of directly from the Next.js API route, without touching the
business logic that decided the event happened.

## What is out of scope for n8n, permanently

- Judging/scoring of any kind (explicitly a human-only process, see the
  project brief).
- Any modification of `evaluations`, `assignments`, or `results` data.
- Anything that would let an external workflow bypass the RLS/permission
  model described in `docs/supabase-schema.md`.
