# Lightning Classics Docs

## Status

This directory is the active project documentation set for Lightning Classics.

It applies the reusable Trainio standards in:

- `trainio_project_development_gold_standard_v0.11.3.md`
- `trainio_technical_setup_standard_v0.11.3.md`

These root-level Trainio files remain reusable standards. This `docs/` directory is where the Lightning Classics project-specific architecture and operating truth should live.

Durable product and UX guidance from one-off briefs or historical prompts must be folded into these canonical docs before those source files are archived.

## Canonical Docs

- `docs/architecture.md`
  Current system baseline and approved AWS target architecture
- `docs/environment-topology.md`
  Current and target environment layout, hostnames, and AWS service relationships
- `docs/runtime-config.md`
  Current and target runtime configuration, including secrets-handling rules
- `docs/migration-baseline.md`
  Modernization scope, non-regression rules, and ordered implementation path
- `docs/implementation-status.md`
  Living record of completed slices, current state, and immediate next steps
- `docs/local-infrastructure-control.md`
  Local AWS ownership, CDK cutover guidance, and non-destructive runbook steps
- `docs/frontend-hosting-cutover.md`
  Route 53, Amplify, and hosted-frontend cutover runbook for `lightningclassics.com`
- `docs/operations-guide.md`
  Production and staging operating guide, verification path, and monitoring baseline
- `docs/incident-and-rollback-runbook.md`
  Short response path for production or staging incidents, rollback, and evidence capture

## Update Rule

If architecture, environment shape, runtime configuration, or trust boundaries change, update the matching doc in the same change set.

Implementation rule:

- no meaningful app, backend, auth, persistence, hosting, or security change is complete until the matching `docs/` file is updated in the same slice
- `docs/implementation-status.md` should be updated as each migration slice lands

## Archive Rule

The following kinds of files should not stay in the active root forever once the modernization is complete:

- one-time migration notes
- Lovable/Replit/Claude-code-specific operating notes
- completed handoff material
- superseded implementation plans

Those should move to `docs/archive/` once they stop being current.

Working-history rule:

- do not delete superseded planning, prompt, or migration-context files by default
- once their durable guidance has been absorbed into the canonical docs, move them into `docs/archive/`
- keep enough history that architectural intent, product context, and migration decisions remain traceable
