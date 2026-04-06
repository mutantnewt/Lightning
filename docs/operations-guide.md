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
- the hosted staging smoke workflow is designed for OIDC-backed AWS access and only runs the smoke job when these GitHub secrets exist:
  - `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN`
  - `LIGHTNING_STAGING_SMOKE_IDENTIFIER`
  - `LIGHTNING_STAGING_SMOKE_PASSWORD`
- the hosted staging smoke workflow runs on manual dispatch and on a daily schedule, using the hosted staging frontend rather than a local Vite server
- the repo now also includes a dedicated GitHub OIDC automation stack, `LightningGithubAutomationStack`
- the repo now also includes `npm run github:smoke:staging:sync-secrets` to bootstrap the staging smoke user and write the three required GitHub repository secrets
- the GitHub-hosted staging smoke path has now been live-verified end to end, including OIDC role assumption, Cognito sign-in, and hosted browser smoke against `https://staging.lightningclassics.com`
- the repo now also includes a matching hosted production smoke workflow plus `npm run github:smoke:production:sync-secrets`
- the GitHub-hosted production smoke path has now also been live-verified end to end, including OIDC role assumption, Cognito sign-in, and hosted browser smoke against `https://lightningclassics.com`
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

Hosted staging smoke in GitHub Actions:

- the workflow lives at `.github/workflows/hosted-staging-smoke.yml`
- it resolves the live staging hosted URL from the deployed AWS stack outputs
- it uses GitHub OIDC plus `aws-actions/configure-aws-credentials@v4`
- it resolves a Linux Chrome or Chromium binary on the runner and passes that path into `CHROME_BIN`
- it intentionally skips the smoke job with a warning when the required secrets are not configured yet
- the required OIDC role is now output by `LightningGithubAutomationStack` as `GitHubHostedSmokeRoleArnStaging`
- the current live proof point is workflow run `24042496599`, which passed on 2026-04-06
- the workflow intentionally skips review-delete cleanup and relies on the deterministic probe-preparation path to remove stale smoke reviews before the next run

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
- bootstraps or resets the staging smoke user in Cognito with a strong password
- writes `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN`
- writes `LIGHTNING_STAGING_SMOKE_IDENTIFIER`
- writes `LIGHTNING_STAGING_SMOKE_PASSWORD`
- leaves the hosted staging workflow ready to run in GitHub Actions
- has been live-verified against the current AWS and GitHub state

Hosted production smoke in GitHub Actions:

- the workflow lives at `.github/workflows/hosted-production-smoke.yml`
- it uses the production OIDC role output from `LightningGithubAutomationStack`
- it is manual-dispatch only, so production smoke remains an operator-triggered verification path
- it uses the hosted production frontend and the environment-specific `LIGHTNING_PRODUCTION_SMOKE_*` credentials
- it intentionally skips review-delete cleanup and relies on deterministic smoke preparation to reset production smoke state between runs
- the current live proof point is workflow run `24043252268`, which passed on 2026-04-06

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
- bootstraps or resets the production smoke user in Cognito with a strong password
- writes `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_PRODUCTION`
- writes `LIGHTNING_PRODUCTION_SMOKE_IDENTIFIER`
- writes `LIGHTNING_PRODUCTION_SMOKE_PASSWORD`
- leaves the hosted production workflow ready to run in GitHub Actions
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

Hosted frontend release verification:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:status
```

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

- attach real email, chat, PagerDuty, or Incident Manager destinations on top of the existing environment alarm topics
- add feature-level business metrics for search success and moderation throughput
- add lifecycle, replication, or cross-account retention on top of the new remote hosted-frontend archive buckets
