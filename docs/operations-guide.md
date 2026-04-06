# Lightning Classics Operations Guide

## Purpose

This guide describes how Lightning Classics is operated in staging and production.

It focuses on:

- deployment flow
- verification steps
- monitoring expectations
- logging expectations
- maintenance cadence
- known future operational improvements

## Environment Baseline

Long-lived environments:

- `local`
- `staging`
- `production`

Primary workload region:

- `eu-west-2`

Current production-facing frontend hosts:

- default Amplify production host `https://main.d1te9vk2z7t41u.amplifyapp.com`
- target custom domain `https://lightningclassics.com`

Current staging frontend hosts:

- default Amplify staging host `https://staging.dy2grocxp5fe9.amplifyapp.com`
- target custom domain `https://staging.lightningclassics.com`

## Deployment Flow

Backend and data-plane infrastructure:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run deploy:staging
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run deploy:production:precutover
```

When a backend observability or security change must be redeployed without relying on a CORS diff, use the forced pre-cutover refresh helpers:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run prepare:staging:hosted-smoke:force
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run prepare:production:hosted-smoke:force
```

Hosted frontend artifact deployment:

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
/usr/local/bin/npm run deploy:staging:manual-amplify
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
/usr/local/bin/npm run deploy:production:manual-amplify
```

Hosted frontend deploy note:

- the manual Amplify publish helper now resolves environment-specific build inputs from the selected frontend stack outputs
- do not rely on developer-local `.env.local` when publishing staging or production artifacts
- the hosted frontend baseline now includes live CSP and security-header verification on the default Amplify domains
- the manual Amplify publish helper now also emits a hosted release manifest at `/lightning-release.json`
- the manual Amplify publish helper now also retains a local rollback artifact under `/Users/steve/Documents/GitHub/Lightning/.local/frontend-releases/<environment>/<releaseId>/`
- the manual Amplify publish helper now also uploads the retained release zip plus `release-archive.json` into the environment-specific S3 archive bucket
- the manual Amplify publish helper now runs under a repo-local deploy lock, so staging and production publishes must be executed serially rather than in parallel
- the release-archive packaging step is now cross-platform: it uses `ditto` on macOS and falls back to `zip` on Linux runners
- the hosted frontend release-archive buckets now also have a lifecycle baseline:
  - abort incomplete multipart uploads after `7` days
  - transition retained `releases/` objects to `INTELLIGENT_TIERING` after `30` days
  - expire noncurrent object versions after `90` days
  - keep current retained release archives available for rollback

Repository validation baseline:

- GitHub Actions now runs a lightweight validation workflow on push and pull request
- the current baseline covers:
  - frontend build
  - backend build
  - backend community-guard validation for duplicate-review blocking and multi-page comment pagination
  - infra TypeScript build
- full-repo lint is still intentionally deferred until the pre-existing repo-wide lint backlog is reduced
- the repo now also includes a dedicated hosted staging smoke workflow in `.github/workflows/hosted-staging-smoke.yml`
- the hosted staging smoke workflow is designed for OIDC-backed AWS access and now only requires the staging role secret:
  - `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN`
- the hosted staging smoke workflow now bootstraps its own dedicated `Staging Local Smoke` user inside the workflow instead of depending on stored smoke identifier and password repository secrets
- the hosted staging smoke workflow runs on manual dispatch and on a daily schedule, using the hosted staging frontend rather than a local Vite server
- the repo now also includes a dedicated GitHub OIDC automation stack, `LightningGithubAutomationStack`
- the repo now also includes `npm run github:smoke:staging:sync-secrets` to publish the required staging OIDC role secret from live AWS outputs
- the GitHub-hosted staging smoke path has now been live-verified end to end, including OIDC role assumption, Cognito sign-in, and hosted browser smoke against `https://staging.lightningclassics.com`
- the repo now also includes a matching hosted production smoke workflow plus `npm run github:smoke:production:sync-secrets`
- the GitHub-hosted production smoke path has now also been live-verified end to end, including OIDC role assumption, Cognito sign-in, and hosted browser smoke against `https://lightningclassics.com`
- the repo now also includes a GitHub OIDC operations-status workflow for staging and production
- the GitHub-hosted operations-status path has now been live-verified for both environments through GitHub Actions
- the GitHub-hosted operations-status workflow now also writes a human-readable summary into the GitHub job summary and uploads it alongside the raw JSON artifact
- the repo now also includes a GitHub OIDC cutover-evidence workflow plus `npm run github:ops:sync-secrets` for its read-only role secret
- the repo now also includes a manual GitHub OIDC alarm-subscriptions workflow plus `npm run github:alerting:sync-secrets` for its dedicated alerting-management role secret
- the repo now also includes a manual GitHub OIDC frontend-release workflow plus `npm run github:frontend:release:sync-secrets` for its dedicated frontend-release role secret
- the repo now also includes `npm run ops:subscribe:emails` as a safe operator wrapper for attaching SNS email subscriptions and then checking live subscription readiness

Custom-domain cutover:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run cutover:complete:with-hosted-smoke
```

## Verification Steps

Fast operator snapshot:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run ops:status
```

Cutover-specific snapshot:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run cutover:evidence
```

Browser-level verification:

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
/usr/local/bin/npm run smoke:staging
```

The staging browser-smoke wrapper now temporarily enables `http://127.0.0.1:5175` in staging CORS and restores the canonical staging-only baseline afterward.
When `LIGHTNING_SMOKE_IDENTIFIER` and `LIGHTNING_SMOKE_PASSWORD` are absent, it also bootstraps a dedicated local staging smoke user automatically instead of depending on the GitHub-hosted smoke credentials.
The underlying operator commands are:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run prepare:staging:local-smoke
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run restore:staging:canonical-cors
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
/usr/local/bin/npm run smoke:production
```

Hosted frontend verification:

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
/usr/local/bin/npm run smoke:staging:hosted
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
/usr/local/bin/npm run smoke:production:hosted
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
/usr/local/bin/npm run smoke:production:hosted:www
```

The dedicated `www` production hosted smoke path now launches the browser at `https://www.lightningclassics.com`, asserts the redirect lands on `https://lightningclassics.com`, and then continues through the normal production hosted smoke flow on the canonical apex host.
This path has now been live-verified on 2026-04-06.
The local hosted smoke wrappers now also bootstrap dedicated local staging or production smoke users automatically when smoke credentials are absent, and they default to deterministic review cleanup between runs instead of inline review deletion.

Hosted staging smoke in GitHub Actions:

- the workflow lives at `.github/workflows/hosted-staging-smoke.yml`
- it resolves the live staging hosted URL from the deployed AWS stack outputs
- it uses GitHub OIDC plus `aws-actions/configure-aws-credentials@v4`
- it resolves a Linux Chrome or Chromium binary on the runner and passes that path into `CHROME_BIN`
- it intentionally skips the smoke job with a warning when the required role secret is not configured yet
- the required OIDC role is now output by `LightningGithubAutomationStack` as `GitHubHostedSmokeRoleArnStaging`
- the current live proof point is workflow run `24050885863`, which passed on 2026-04-06
- the workflow intentionally skips review-delete cleanup and relies on the deterministic probe-preparation path to remove stale smoke reviews before the next run
- the workflow now bootstraps or resets the dedicated `Staging Local Smoke` user directly through the hosted smoke OIDC role and no longer depends on stored smoke-user secrets

Hosted staging smoke secret sync:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:smoke:staging:sync-secrets -- --dry-run
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:smoke:staging:sync-secrets
```

This flow now:

- reads the live OIDC role ARN from `LightningGithubAutomationStack`
- writes `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN`
- leaves the hosted staging workflow ready to run in GitHub Actions
- has been live-verified against the current AWS and GitHub state
- no longer needs to write smoke-user identifier or password secrets because the workflow self-bootstraps them at runtime

Hosted production smoke in GitHub Actions:

- the workflow lives at `.github/workflows/hosted-production-smoke.yml`
- it uses the production OIDC role output from `LightningGithubAutomationStack`
- it is manual-dispatch only, so production smoke remains an operator-triggered verification path
- it uses the hosted production frontend and now bootstraps a dedicated `Production Local Smoke` user inside the workflow at runtime
- it now runs both the canonical apex hosted smoke and the `www.lightningclassics.com` redirect-alias smoke in the same workflow job
- it intentionally skips review-delete cleanup and relies on deterministic smoke preparation to reset production smoke state between runs
- the current live proof point is workflow run `24050885734`, which passed on 2026-04-06 and covered both the canonical production apex path and the `www` redirect alias
- the GitHub Actions workflow baseline is now upgraded to Node 24-ready action majors across checkout, setup-node, and configure-aws-credentials, with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` applied during the transition
- the workflow now bootstraps or resets the dedicated `Production Local Smoke` user directly through the hosted smoke OIDC role and no longer depends on stored production smoke-user secrets

Hosted production smoke secret sync:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:smoke:production:sync-secrets -- --dry-run
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:smoke:production:sync-secrets
```

This flow now:

- reads the live production OIDC role ARN from `LightningGithubAutomationStack`
- writes `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_PRODUCTION`
- leaves the hosted production workflow ready to run in GitHub Actions
- has been live-verified against the current AWS and GitHub state
- no longer needs to write smoke-user identifier or password secrets because the workflow self-bootstraps them at runtime

Operations status in GitHub Actions:

- the workflow lives at `.github/workflows/ops-status.yml`
- it runs on manual dispatch and a daily schedule
- it uses GitHub OIDC plus the existing staging and production role secrets
- it runs the same `print-operations-status.mjs` check used by local operators
- it uploads per-environment JSON artifacts for staging and production
- the current live proof point is workflow run `24046418678`, which passed on 2026-04-06

Cutover evidence in GitHub Actions:

- the workflow lives at `.github/workflows/cutover-evidence.yml`
- it runs on manual dispatch and on a weekly schedule
- it uses a dedicated GitHub OIDC read-only role from `LightningGithubAutomationStack`
- it runs the same `capture-cutover-evidence.mjs` operator command used locally
- it uploads a `cutover-evidence.json` artifact for handoff and audit use
- the current live proof point is workflow run `24048658255`, which passed on 2026-04-06 and uploaded the cutover evidence artifact

Cutover evidence secret sync:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:ops:sync-secrets -- --dry-run
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:ops:sync-secrets
```

This flow now:

- reads the live operations-read OIDC role ARN from `LightningGithubAutomationStack`
- writes `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_OPERATIONS`
- leaves the GitHub cutover-evidence workflow ready to run
- has been live-verified against the current AWS and GitHub state

Alarm email subscription workflow:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run ops:subscribe:emails -- --dry-run
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run ops:subscribe:emails
```

This flow:

- deploys the matching backend stack change for `staging` and `production`
- keeps the configured email list in one place via `LIGHTNING_ALARM_NOTIFICATION_EMAILS`
- immediately runs `ops:status` per environment after deploy
- makes the post-deploy state explicit when SNS subscriptions are still `PendingConfirmation`

Direct live-topic email subscription workflow:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run ops:subscribe:emails:direct -- --dry-run
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run ops:subscribe:emails:direct
```

This flow:

- reads the live SNS topic ARNs from the deployed staging and production stack outputs
- attaches email subscriptions directly to the existing SNS alarm topics without a CDK deploy
- skips already-present email subscriptions so repeated runs stay idempotent
- immediately re-runs `ops:status` so the live post-subscription state is visible
- is the fastest path for closing the current live alert-delivery gap
- does not change the stack output `OperationsAlarmNotificationEmailCount`, so deploy-time configuration remains the preferred fully codified path when desired

Alarm subscriptions in GitHub Actions:

- the workflow lives at `.github/workflows/alarm-subscriptions.yml`
- it runs on manual dispatch only
- it accepts:
  - `environment`
  - `dry_run`
  - `emails`
- it uses a dedicated GitHub OIDC role secret:
  - `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_ALERTING`
- it can take a comma-separated `emails` workflow input or fall back to the repository secret:
  - `LIGHTNING_ALARM_NOTIFICATION_EMAILS`
- it runs the same `scripts/subscribe-alarm-topic-emails.mjs` operator path used locally, so dry-run and live behavior stay aligned
- it now writes a human-readable readiness summary into the GitHub job summary and uploads both the raw JSON and the rendered summary as workflow artifacts
- dry-run artifacts now also include the current `ops:status` alert-readiness snapshot for each target environment, so missing confirmations are visible before any live subscription attempt
- `npm run github:alerting:sync-secrets` now publishes the live alerting-management role ARN from `LightningGithubAutomationStack`
- the recommended first use is a dry-run dispatch with a placeholder address such as `ops@example.com`, because that validates role assumption and workflow wiring without creating SNS subscriptions
- the current live proof point is workflow run `24052959607`, which passed on 2026-04-06 in dry-run mode with the readiness-summary and artifact path enabled

Hosted frontend release verification:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:status
```

Frontend release in GitHub Actions:

- the workflow lives at `.github/workflows/frontend-release.yml`
- it is manual-dispatch only
- it accepts a single `environment` input:
  - `staging`
  - `production`
- it uses a dedicated GitHub OIDC role secret:
  - `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_FRONTEND_RELEASE`
- it runs the existing hosted frontend publish path in `scripts/deploy-manual-amplify-frontend.mjs`
- it then runs `scripts/print-hosted-frontend-release-status.mjs --require-match` so the live release manifest is verified immediately after publish
- it now also writes a human-readable release summary into the GitHub job summary and uploads that rendered summary alongside the raw JSON artifacts
- it now also assumes the existing hosted-smoke role for the target environment and runs the real browser smoke after publish:
  - staging uses `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN`
  - production uses `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_PRODUCTION`
- the smoke-user bootstrap path now passes auto-generated passwords to the AWS CLI in `--flag=value` form so passwords that begin with `-` do not break production smoke-user resets on GitHub runners
- `npm run github:frontend:release:sync-secrets` now publishes the live frontend-release role ARN from `LightningGithubAutomationStack`
- the workflow has now been live-verified in both environments on 2026-04-06:
  - staging run `24052374191`
  - production run `24052639174`
- the release-summary enhancement has also been live-verified on 2026-04-06 through:
  - staging run `24053096652`
  - production run `24053203654`

Hosted frontend release archive inventory:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:archives
```

Hosted frontend retained-archive backfill:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:sync
```

Hosted frontend retained-archive integrity verification:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:verify
```

This now reports:

- local archive presence
- remote S3 archive presence
- remote bucket name
- remote object keys
- remote upload timestamp
- remote metadata consistency
- remote ZIP SHA-256 integrity against the recorded release metadata

Minimum expected healthy state:

- public health endpoint returns `200`
- no staging or production CloudWatch alarms are in `ALARM`
- hosted frontend root and favicon respond successfully
- hosted frontend root returns the codified `Content-Security-Policy`
- hosted frontend `/lightning-release.json` matches the expected stack outputs for the environment under test
- browser smoke passes for the environment under test

Frontend rollback baseline:

- use the retained frontend release archives plus `frontend:release:redeploy:<environment>` for the first recovery step on a hosted frontend-only incident
- the redeploy path now falls back to the environment-specific S3 archive bucket if the local archive copy is missing
- the S3 lifecycle baseline does not delete current retained release archives, so rollback still works after release objects age into `INTELLIGENT_TIERING`
- if `frontend:release:archives` shows a retained local archive without remote presence, run `frontend:release:sync` to backfill it into the S3 archive bucket before the next incident
- run `frontend:release:verify` after backfill or before rollback if you want to confirm the retained S3 zip still matches the recorded SHA-256 metadata
- the remote-restore rehearsal is now live-verified in both staging and production
- after redeploy, rerun `frontend:release:status` and the hosted browser smoke for the affected environment
- if hosted smoke from a default Amplify domain fails with browser `Failed to fetch`, treat it as a likely pre-cutover CORS drift check first:
  - run `npm run prepare:staging:hosted-smoke:force` or `npm run prepare:production:hosted-smoke:force`
  - confirm the API again returns `Access-Control-Allow-Origin` for the matching Amplify hostname
  - rerun the hosted browser smoke

## Monitoring Expectations

The current codified CloudWatch baseline for `staging` and `production` is:

- HTTP API 5xx alarm
- public API Lambda errors alarm
- authenticated API Lambda errors alarm
- privileged API Lambda errors alarm
- public API Lambda throttles alarm
- authenticated API Lambda throttles alarm
- privileged API Lambda throttles alarm
- environment-specific CloudWatch dashboard with:
  - HTTP API 4xx and 5xx
  - HTTP API p95 latency
  - Lambda invocations
  - Lambda errors and throttles
- dedicated API Gateway access log group per environment:
  - `/aws/apigateway/lightning-http-api-access-staging`
  - `/aws/apigateway/lightning-http-api-access-prod`
- active Lambda tracing on public, authenticated, and privileged runtimes
- HTTP API default-route throttling enabled at the API edge:
  - staging burst `50`, rate `25`
  - production burst `100`, rate `50`
- HTTP API route-level throttling now tightens authenticated and privileged namespaces further:
  - staging `POST|PUT /auth/{proxy+}` burst `16`, rate `8`
  - staging `DELETE /auth/{proxy+}` burst `12`, rate `6`
  - staging `POST /privileged/{proxy+}` burst `12`, rate `6`
  - production `POST|PUT /auth/{proxy+}` burst `30`, rate `15`
  - production `DELETE /auth/{proxy+}` burst `20`, rate `10`
  - production `POST /privileged/{proxy+}` burst `20`, rate `10`
- one SNS alarm topic per environment with every codified alarm wired to it:
  - `lightning-operations-alerts-staging`
  - `lightning-operations-alerts-prod`
- optional email subscriptions can be attached at deploy time with:
  - context `alarmNotificationEmails=email1@example.com,email2@example.com`
  - env var `LIGHTNING_ALARM_NOTIFICATION_EMAILS=email1@example.com,email2@example.com`
- `npm run ops:subscribe:emails` now wraps that same capability with a safer operator flow and immediate post-deploy readiness reporting
- `npm run ops:subscribe:emails:direct` now also supports attaching SNS email subscriptions directly to the live alarm topics without a stack deploy
- `ops:status` now treats staging and production as not fully clear until at least one confirmed live alarm destination exists, even when the stack-level configured email count is still `0`
- the hosted frontend release-archive buckets now also have cost/governance lifecycle rules without deleting current retained archives

Operator check:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run ops:status
```

Healthy operator expectation now includes:

- public health endpoint returns `200`
- no codified alarms are in `ALARM`
- `alarmActionCoverage.complete` is `true` for the environment under review
- `alarmSubscriptionReadiness.ready` is `true` for the environment under review
- `alarmSubscriptionReadiness.confirmedCount` is at least `1` in staging and production unless a higher configured-email target is in use

Current alarm scope intentionally favors low-noise platform failure indicators over feature-specific business alarms.

Bootstrap note:

- the shared CDK bootstrap stack in `eu-west-2` was updated during this observability rollout
- if a future deploy reports that the bootstrap toolkit version is too old for the deployment role, rerun:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
npx cdk bootstrap aws://310505389001/eu-west-2
```

## Logging Expectations

Current logging baseline:

- Lambda logs flow to CloudWatch Logs
- API Gateway access logs flow to dedicated CloudWatch log groups:
  - `/aws/apigateway/lightning-http-api-access-staging`
  - `/aws/apigateway/lightning-http-api-access-prod`
- Lambda tracing is enabled with `TracingConfig.Mode=Active`
- API health and browser smoke remain the first operator checks
- logs should be inspected per runtime surface:
  - `lightning-public-api-<env>`
  - `lightning-auth-api-<env>`
  - `lightning-privileged-api-<env>`

Current log review expectation:

- inspect logs for the specific runtime surface that matches the failing route or smoke step
- inspect API Gateway access logs when the issue might be route-level, CORS-level, or authorizer-edge rather than Lambda-code-level
- correlate Lambda errors with any CloudWatch alarm state before taking rollback action
- use X-Ray traces to confirm whether failures are isolated to one runtime surface or spread across the request path

## Maintenance Cadence

Per deployment:

- run environment smoke for the touched environment
- confirm `ops:status` is healthy

Weekly:

- review staging and production alarms
- review CloudWatch dashboards for elevated latency or repeated throttling
- review whether repeated 429s are concentrated on authenticated or privileged write methods before relaxing limits
- review pending moderation backlog

Before major release or cutover:

- capture `cutover:evidence`
- confirm smoke-user bootstrap still works
- confirm staging and production hosted smoke paths still pass

## Known Future Operational Improvements

- attach real chat, PagerDuty, or Incident Manager destinations on top of the existing environment alarm topics after at least one confirmed email destination is in place
- add feature-level business metrics for search success and moderation throughput
- add lifecycle, replication, or cross-account retention on top of the new remote hosted-frontend archive buckets
