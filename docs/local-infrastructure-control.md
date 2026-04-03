# Lightning Classics Local Infrastructure Control

## Status

This document defines how the local Lightning Classics AWS resources move from manual setup to CDK ownership.

It exists because the repo now has:

- a codified local stack in `infra/`
- a repeatable bootstrap script in `scripts/bootstrap-local-aws.mjs`
- a local environment that has now been cut over to CloudFormation ownership

## Working Rule

Do not treat local AWS infrastructure as fully hardened until one of these is true:

- the live local resources are recreated under CDK control
- the live local resources are successfully imported into CloudFormation and verified

Current status:

- satisfied for the `local` environment as of 2026-04-02

Until then:

- CDK is the intended system of record
- the current local resources are transitional
- destructive local AWS changes should only happen after a backup/export step

## Current Verified State

As of 2026-04-02:

- the live local AWS resources have been recreated under `LightningLocalStack`
- the live ownership report returns `ownershipStatus: stack-managed`
- the current local Cognito user-pool ID is `eu-west-2_XUvLTh3ek`
- the current local Cognito app-client ID is `g7bdf28kd08fse6lhtsle0fci`
- the current local stack also owns:
  - Lambda `lightning-public-api-local`
  - Lambda `lightning-auth-api-local`
  - Lambda `lightning-privileged-api-local`
  - the HTTP API emitted as the `HttpApiUrl`, `PublicApiBaseUrl`, `AuthApiBaseUrl`, and `PrivilegedApiBaseUrl` stack outputs
- `scripts/bootstrap-local-aws.mjs --require-cdk` succeeds and resolves resources from `cdk-stack`
- the browser smoke succeeds against the CloudFormation-owned local stack
- the deployed public/auth runtime also passes live verification with a real Cognito JWT
- the deployed privileged runtime also passes live verification for Add Book search/details and duplicate-protected accept conflict handling
- the deployed privileged runtime now also passes moderator queue reads with a real Cognito moderator token
- the packaged deployed browser smoke now also passes moderation-queue verification when the smoke user is temporarily elevated into the moderator group
- local and deployed privileged moderation now also support defer/reject transitions with persisted notes
- local and deployed browser smoke verification now also covers a real reject/defer moderation decision against a deterministic synthetic submission
- the local bootstrap flow can now also confirm the smoke user and seed the minimal DynamoDB-backed smoke baseline with `--ensure-smoke-user`

The pre-cutover verified local DynamoDB backup export remains available at:

- `backend/.local/backups/local-aws-2026-04-02T08-54-48-566Z/`

Pre-cutover exported item counts:

- `lightning-books-local`: 23
- `lightning-user-state-local`: 4
- `lightning-book-suggestions-local`: 3

## Recommended Direction

For the `local` environment, the recommended hardening path is:

- prefer clean recreation under CDK control over CloudFormation import

Reasoning:

- local data is reproducible enough to reseed safely
- catalog data is already seedable through `npm run seed:catalog`
- import paths are more brittle and easier to get subtly wrong
- clean recreation is closer to Yan Cui's bias toward disposable, repeatable infrastructure

Import remains possible, but it is not the default recommendation for this repo's local environment.

## Current Commands

### Ownership report

Use this command first:

```sh
/usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/check-local-aws-ownership.mjs
```

This command reports:

- whether `LightningLocalStack` exists
- whether the currently resolved Cognito and DynamoDB resources match the stack resources
- whether the local environment is stack-managed, manual, or drifted

### DynamoDB backup export

Before any destructive local AWS cutover, export the current local DynamoDB tables:

```sh
/usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/export-local-dynamo-backup.mjs
```

Current backup location:

- `backend/.local/backups/<env>-aws-<timestamp>/`

This export currently covers:

- `lightning-books-local`
- `lightning-user-state-local`
- `lightning-book-suggestions-local`

### DynamoDB backup restore/import

To inspect a restore plan without writing:

```sh
/usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/restore-local-dynamo-backup.mjs --backup-dir /absolute/path/to/backup --dry-run
```

To restore a backup into empty recreated tables:

```sh
/usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/restore-local-dynamo-backup.mjs --backup-dir /absolute/path/to/backup
```

To replay a backup into non-empty tables intentionally:

```sh
/usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/restore-local-dynamo-backup.mjs --backup-dir /absolute/path/to/backup --allow-non-empty
```

Behavior:

- resolves the current local target tables from `LightningLocalStack` outputs when available
- reads the backup `manifest.json` and exported `*.items.json` files
- reports target table counts during dry-run
- refuses to write into non-empty target tables unless `--allow-non-empty` is supplied
- restores data with retry-aware DynamoDB batch writes

Current verified use:

- dry-run now reports the restore plan against the live local stack
- live same-data restore with `--allow-non-empty` passed on 2026-04-02 against:
  - `lightning-books-local`
  - `lightning-user-state-local`
  - `lightning-book-suggestions-local`

### CDK-aware env sync and seeding

Once the stack exists, use:

```sh
env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_API_BASE_URL=http://127.0.0.1:8787 /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs --require-cdk
```

This now:

- prefers CloudFormation outputs when `LightningLocalStack` exists
- refreshes `backend/.env.local`
- refreshes `literary-light/.env.local`
- reseeds the catalog unless `--skip-seed` is supplied

Optional smoke-user bootstrap:

```sh
env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_API_BASE_URL=http://127.0.0.1:8787 LIGHTNING_SMOKE_IDENTIFIER=your-test-user@example.com LIGHTNING_SMOKE_PASSWORD='YourPasswordHere' /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs --require-cdk --ensure-smoke-user
```

This now also:

- confirms or creates the local smoke user in Cognito
- enforces a permanent password for that user
- removes temporary moderator-group membership if it exists
- seeds the minimal DynamoDB-backed favorite and reading-list records needed by the browser smoke

### Frontend API-Gateway smoke mode

The repo now includes a first-class deployed browser-smoke command:

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
env LIGHTNING_SMOKE_IDENTIFIER=... LIGHTNING_SMOKE_PASSWORD=... npm run smoke:deployed-api
```

This command now:

- switches `literary-light/.env.local` into `deployed-api` mode with `scripts/bootstrap-local-aws.mjs --require-cdk --skip-seed`
- starts a temporary Vite dev server on `http://127.0.0.1:5175`
- runs the browser smoke against the deployed API Gateway URLs
- restores `literary-light/.env.local` to `local-backend` mode in a `finally` path

Operational note:

- port `5175` must be free before running `npm run smoke:deployed-api`
- the command does not kill an existing frontend dev server for safety

Advanced/manual equivalent:

To point the frontend at the deployed API Gateway URLs for browser-led verification without the wrapper:

```sh
env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_FRONTEND_API_MODE=deployed-api /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs --require-cdk --skip-seed
```

Then restart the frontend dev server and run the browser smoke manually.

Current verified use:

- this mode now passes the browser smoke for comments, ratings, reviews, and Add Book search/details through the deployed API Gateway path
- `cd /Users/steve/Documents/GitHub/Lightning/literary-light && env LIGHTNING_SMOKE_IDENTIFIER=... LIGHTNING_SMOKE_PASSWORD=... npm run smoke:deployed-api` now provides the repeatable supported path
- the packaged command passed on 2026-04-02 against the live `LightningLocalStack` API Gateway URLs and restored `local-backend` mode afterward

Optional moderator coverage:

- set `LIGHTNING_SMOKE_VERIFY_MODERATION=true` to make the browser smoke visit `/moderation` and wait for a loaded moderation result
- set `LIGHTNING_SMOKE_AUTO_MODERATOR=true` to let the smoke temporarily grant and later revoke membership in `lightning-catalog-moderators-local`
- set `LIGHTNING_SMOKE_MODERATION_ACTION=defer` if you want the moderation smoke to defer the synthetic submission instead of rejecting it; the default action is `reject`
- if you prefer manual control, leave `LIGHTNING_SMOKE_AUTO_MODERATOR` unset and manage the group directly with the moderator script below

Synthetic moderation probe:

- moderation-enabled smoke runs now prepare `book-suggestion-submission:lightning-smoke-moderation-local` through `/Users/steve/Documents/GitHub/Lightning/scripts/manage-smoke-moderation-submission.mjs`
- the probe is intentionally synthetic and should be rejected or deferred, never published

### Moderator lifecycle automation

The repo now includes a dedicated moderator lifecycle helper:

```sh
/usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/manage-local-moderator.mjs status --identifier your-test-user@example.com
```

Supported actions:

- `status`
- `grant`
- `revoke`

Behavior:

- resolves the local Cognito user pool and moderator group from `LightningLocalStack` by default
- accepts a sign-in email via `--identifier`
- resolves the immutable Cognito username automatically when an email is supplied
- reports the resulting group state as JSON for easy scripting

Recommended smoke path:

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
env LIGHTNING_SMOKE_IDENTIFIER=... LIGHTNING_SMOKE_PASSWORD=... LIGHTNING_SMOKE_VERIFY_MODERATION=true LIGHTNING_SMOKE_AUTO_MODERATOR=true npm run smoke:deployed-api
```

This now:

- grants moderator access just before the smoke starts
- prepares a deterministic pending smoke submission
- runs the moderation-enabled browser smoke
- executes a real reject or defer action through the rendered moderation UI
- revokes moderator access again during cleanup
- restores `local-backend` mode afterward

To restore the default fast-feedback loop afterward:

```sh
env LIGHTNING_FRONTEND_ORIGIN=http://127.0.0.1:5175 LIGHTNING_FRONTEND_API_MODE=local-backend /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs --require-cdk --skip-seed
```

### Smoke-user bootstrap helper

The repo now includes a dedicated smoke-user bootstrap helper:

```sh
env LIGHTNING_SMOKE_IDENTIFIER=your-test-user@example.com LIGHTNING_SMOKE_PASSWORD='YourPasswordHere' /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-smoke-user.mjs
```

Behavior:

- resolves the local Cognito user pool and user-state table from `LightningLocalStack` by default
- confirms or creates the smoke user
- sets `name=Local Smoke` unless overridden
- keeps the immutable Cognito username stable
- removes temporary moderator-group access if it was left behind
- seeds the minimal user-state baseline required by the browser smoke

Current verified use:

- the helper now returns:
  - Cognito username
  - Cognito `sub`
  - confirmation status
  - moderator cleanup result
  - seeded favorite and reading-list records

## Recommended Cutover Sequence

### Phase 1: Non-destructive validation

1. Run the ownership report.
2. Export the local DynamoDB backup.
3. Run `cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run synth`.

### Phase 2: Move local to CDK ownership

Recommended approach:

1. Ensure no irreplaceable local-only data remains outside the DynamoDB backup.
2. Recreate the local AWS resources under `LightningLocalStack`.
3. Deploy the local stack runtime surfaces with `cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run deploy:local`.
4. Run the CDK-aware bootstrap command with `--require-cdk`.
5. Restore DynamoDB data from the exported backup if needed.
6. Reseed catalog data when the backup should not be used for shared catalog recovery.
7. Recreate or re-confirm any local test users needed for smoke testing.
   Recommended: run `scripts/bootstrap-local-aws.mjs --require-cdk --ensure-smoke-user` with `LIGHTNING_SMOKE_IDENTIFIER` and `LIGHTNING_SMOKE_PASSWORD`.
8. Run the browser smoke:

```sh
env LIGHTNING_SMOKE_IDENTIFIER=... LIGHTNING_SMOKE_PASSWORD=... /usr/local/bin/node /Users/steve/Documents/GitHub/Lightning/scripts/local-frontend-smoke.mjs
```

Current status:

- completed on 2026-04-02 for the `local` environment

Operational note:

- `ALLOW_LOCAL_AUTH_HEADERS=true` is only for the local Node backend
- deployed Lambda runtimes must not enable that bridge
- the deployed `/auth/*` path should stay Cognito-JWT-only
- the deployed `/privileged/*` path is now Cognito-JWT-protected
- moderator-only publication now requires the Cognito group `lightning-catalog-moderators-local`

## Explicit Non-Goals

This runbook does not yet provide:

- an automated Cognito user export/import path for local users
- a one-command CloudFormation import workflow

Those can be added later if the local environment proves valuable enough to preserve at that level.

## Success Criteria

The local environment should be considered CloudFormation-hardened when:

- `scripts/check-local-aws-ownership.mjs` reports `stack-managed`
- `scripts/bootstrap-local-aws.mjs --require-cdk` succeeds
- `cd /Users/steve/Documents/GitHub/Lightning/infra && /usr/local/bin/npm run deploy:local` succeeds
- the browser smoke succeeds on:
  - sign-in
  - favorites
  - comment create/delete
  - rating persistence
  - review create/delete
  - Add Book search/details
- the deployed public/auth runtime succeeds on:
  - `GET /public/health`
  - `GET /auth/me` with a real Cognito ID token
- the deployed privileged runtime succeeds on:
  - `POST /privileged/book-suggestions/search`
  - `POST /privileged/book-suggestions/details`
  - `POST /privileged/book-suggestions/submit` for an authenticated user
  - `POST /privileged/book-suggestions/accept` returning `403` for an authenticated non-moderator
- the deployed privileged runtime also succeeds on:
  - `GET /privileged/book-suggestions/submissions` with a real Cognito moderator token
  - `POST /privileged/book-suggestions/accept` returning `409 Conflict` for a known duplicate when exercised with a real Cognito moderator token
  - `POST /privileged/book-suggestions/defer` with moderator notes
  - `POST /privileged/book-suggestions/reject` with moderator notes
- the browser smoke also succeeds when the frontend is switched into `deployed-api` mode
- the packaged `npm run smoke:deployed-api` command succeeds and restores `local-backend` mode afterward
- the packaged `npm run smoke:deployed-api` command also succeeds with `LIGHTNING_SMOKE_VERIFY_MODERATION=true` after temporary moderator elevation
- the packaged `npm run smoke:deployed-api` command now also succeeds with `LIGHTNING_SMOKE_VERIFY_MODERATION=true LIGHTNING_SMOKE_AUTO_MODERATOR=true`, proving automated grant and cleanup
- the packaged `npm run smoke:deployed-api` command now also succeeds with a real browser-led reject decision against the synthetic moderation probe and persisted `rejected` status afterward
- the dedicated smoke-user bootstrap helper and the integrated `--ensure-smoke-user` bootstrap path both succeed against the live local stack
