# Lightning Classics Infrastructure

This directory codifies the Lightning Classics AWS baseline with AWS CDK.

Current focus:

- Cognito user pool and SPA app client
- DynamoDB tables for catalog, user state, and book-suggestion audit data
- Lambda-backed public and authenticated runtime surfaces
- Lambda-backed privileged runtime surface
- API Gateway HTTP API for deployed local-stack verification
- explicit long-lived environment definitions for local, staging, and production
- Route 53 DNS and Amplify frontend-hosting codification for staging and production

Primary commands:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm install
/usr/local/bin/npm run synth
/usr/local/bin/npm run deploy:local
```

Environment commands:

- local:
  - `/usr/local/bin/npm run synth:local`
  - `/usr/local/bin/npm run diff:local`
  - `/usr/local/bin/npm run deploy:local`
- staging:
  - `/usr/local/bin/npm run synth:staging`
  - `/usr/local/bin/npm run diff:staging`
  - `/usr/local/bin/npm run deploy:staging`
  - `/usr/local/bin/npm run ops:status:staging`
- production:
  - `/usr/local/bin/npm run synth:production`
  - `/usr/local/bin/npm run diff:production`
  - `/usr/local/bin/npm run deploy:production`
  - `/usr/local/bin/npm run deploy:production:precutover`
  - `/usr/local/bin/npm run ops:status:production`
- DNS:
  - `/usr/local/bin/npm run synth:dns`
  - `/usr/local/bin/npm run diff:dns`
  - `/usr/local/bin/npm run deploy:dns`
  - `/usr/local/bin/npm run check:domain:delegation`
  - `/usr/local/bin/npm run frontend:release:status`
  - `/usr/local/bin/npm run frontend:release:status:staging`
  - `/usr/local/bin/npm run frontend:release:status:production`
- `/usr/local/bin/npm run frontend:release:archives`
- `/usr/local/bin/npm run frontend:release:archives:staging`
- `/usr/local/bin/npm run frontend:release:archives:production`
- `/usr/local/bin/npm run frontend:release:sync`
- `/usr/local/bin/npm run frontend:release:sync:staging`
- `/usr/local/bin/npm run frontend:release:sync:production`
- `/usr/local/bin/npm run frontend:release:verify`
- `/usr/local/bin/npm run frontend:release:verify:staging`
- `/usr/local/bin/npm run frontend:release:verify:production`
- `/usr/local/bin/npm run frontend:release:redeploy:staging -- --release-id <release-id>`
- `/usr/local/bin/npm run frontend:release:redeploy:production -- --release-id <release-id>`
  - `/usr/local/bin/npm run cutover:status`
  - `/usr/local/bin/npm run ops:status`
  - `/usr/local/bin/npm run cutover:evidence`
  - `/usr/local/bin/npm run cutover:evidence:with-hosted-smoke`
  - `/usr/local/bin/npm run cutover:wait`
  - `/usr/local/bin/npm run cutover:wait-and-finalize`
  - `/usr/local/bin/npm run cutover:wait-and-finalize:with-hosted-smoke`
  - `/usr/local/bin/npm run cutover:complete`
  - `/usr/local/bin/npm run cutover:complete:with-hosted-smoke`
  - `/usr/local/bin/npm run cutover:finalize -- --dry-run`
  - `/usr/local/bin/npm run cutover:finalize:with-hosted-smoke`
  - `/usr/local/bin/npm run prepare:staging:hosted-smoke`
  - `/usr/local/bin/npm run prepare:production:hosted-smoke`
- automation:
  - `/usr/local/bin/npm run synth:automation`
  - `/usr/local/bin/npm run diff:automation`
  - `/usr/local/bin/npm run deploy:automation`
  - `/usr/local/bin/npm run github:smoke:staging:sync-secrets`
  - `/usr/local/bin/npm run github:smoke:production:sync-secrets`
- hosted frontend:
  - staging:
    - `/usr/local/bin/npm run synth:frontend:staging`
    - `/usr/local/bin/npm run diff:frontend:staging`
    - `/usr/local/bin/npm run deploy:frontend:staging`
    - `/usr/local/bin/npm run deploy:frontend:staging:domain`
    - `/usr/local/bin/npm run verify:frontend:staging:domain`
    - `/usr/local/bin/npm run deploy:frontend:staging -- --parameters AmplifyDeploymentMode=REPOSITORY --parameters AmplifyAccessToken=...`
  - production:
    - `/usr/local/bin/npm run synth:frontend:production`
    - `/usr/local/bin/npm run diff:frontend:production`
    - `/usr/local/bin/npm run deploy:frontend:production`
    - `/usr/local/bin/npm run deploy:frontend:production:domain`
    - `/usr/local/bin/npm run deploy:frontend:domains`
    - `/usr/local/bin/npm run verify:frontend:production:domain`
    - `/usr/local/bin/npm run verify:frontend:domains`
    - `/usr/local/bin/npm run cutover:finalize`
    - `/usr/local/bin/npm run deploy:frontend:production:precutover`
    - `/usr/local/bin/npm run deploy:frontend:production -- --parameters AmplifyDeploymentMode=REPOSITORY --parameters AmplifyAccessToken=...`

Long-lived environment baseline:

- stack id: `LightningLocalStack`
- stack id: `LightningStagingStack`
- stack id: `LightningProductionStack`
- region baseline: `eu-west-2`
- frontend origin baselines:
  - local: `http://127.0.0.1:5175`
  - staging: `https://staging.lightningclassics.com`
  - production: `https://lightningclassics.com`
- resource suffix baselines:
  - local: `local`
  - staging: `staging`
  - production: `prod`

Current local stack target:

- stack id: `LightningLocalStack`
- deployed function names:
  - `lightning-public-api-local`
  - `lightning-auth-api-local`
  - `lightning-privileged-api-local`

Current staging stack target:

- stack id: `LightningStagingStack`
- API base URL: `https://pbs76ug4gc.execute-api.eu-west-2.amazonaws.com`
- user pool name: `lightning-users-staging`
- user pool ID: `eu-west-2_8k7xYV4Bi`
- app client name: `lightning-web-staging`
- app client ID: `54fkqa4iernu1lh2bs8ddcrp4d`
- deployed function names:
  - `lightning-public-api-staging`
  - `lightning-auth-api-staging`
  - `lightning-privileged-api-staging`
- staging canonical CORS allow-list:
  - `https://staging.lightningclassics.com`
- explicit operator-only temporary staging CORS broadening paths:
  - local smoke: `npm run prepare:staging:local-smoke`
  - local smoke restore: `npm run restore:staging:canonical-cors`
  - hosted default-Amplify smoke: `npm run prepare:staging:hosted-smoke`
- staging operations dashboard:
  - `lightning-operations-staging`

Current production stack target:

- stack id: `LightningProductionStack`
- API base URL: `https://ejyo5np488.execute-api.eu-west-2.amazonaws.com`
- user pool name: `lightning-users-prod`
- user pool ID: `eu-west-2_Pi9wmd5S9`
- app client name: `lightning-web-prod`
- app client ID: `7nhs7brc3dphqg1dlaovinlbar`
- deployed function names:
  - `lightning-public-api-prod`
  - `lightning-auth-api-prod`
  - `lightning-privileged-api-prod`
- production pre-cutover CORS allow-list:
  - `https://lightningclassics.com`
  - `http://127.0.0.1:5175`
  - `https://main.d1te9vk2z7t41u.amplifyapp.com`
- production operations dashboard:
  - `lightning-operations-prod`

Hosted frontend baseline:

- Route 53 stack id: `LightningDnsStack`
- hosted frontend stack id: `LightningStagingFrontendStack`
- hosted frontend stack id: `LightningProductionFrontendStack`
- hosted frontend app names:
  - `lightning-frontend-staging`
  - `lightning-frontend-prod`
- staging hosted frontend is deployed as:
  - stack id `LightningStagingFrontendStack`
  - Amplify app ID `dy2grocxp5fe9`
  - default domain `dy2grocxp5fe9.amplifyapp.com`
  - hosted URL `https://staging.dy2grocxp5fe9.amplifyapp.com`
  - deployment mode `MANUAL`
- production hosted frontend is deployed as:
  - stack id `LightningProductionFrontendStack`
  - Amplify app ID `d1te9vk2z7t41u`
  - default domain `d1te9vk2z7t41u.amplifyapp.com`
  - hosted URL `https://main.d1te9vk2z7t41u.amplifyapp.com`
  - deployment mode `MANUAL`
- hosted frontend stacks now default to manual artifact deployment and can be switched to repository mode with:
  - `AmplifyDeploymentMode=REPOSITORY`
  - `AmplifyAccessToken=...`
- optional custom certificate support is exposed through `AmplifyCustomCertificateArn`
- the manual hosted-artifact publish helper now injects environment-specific Vite values from the selected frontend stack outputs instead of relying on local `.env.local`
- the default Amplify hosts now return the codified CSP/security-header baseline, including `Content-Security-Policy` and `Cross-Origin-Resource-Policy`
- the manual hosted-artifact publish helper now also emits a release manifest at `/lightning-release.json`
- the repo now includes `scripts/print-hosted-frontend-release-status.mjs` plus `npm run frontend:release:status*` commands for live release verification
- the repo now also retains local hosted frontend release archives under `.local/frontend-releases/`
- the hosted frontend release archive step is now cross-platform, using `ditto` on macOS and `zip` on Linux runners
- the repo now also includes `LightningGithubAutomationStack`, which provisions least-privilege GitHub OIDC hosted-smoke roles for staging and production
- `LightningGithubAutomationStack` now also provisions a dedicated read-only GitHub OIDC operations role for cutover evidence capture and other read-only operator workflows
- `LightningGithubAutomationStack` now also provisions dedicated GitHub OIDC roles for:
  - alerting-management automation
  - manual hosted frontend releases
- the staging GitHub secret-sync path is now live-verified through `npm run github:smoke:staging:sync-secrets`
- the hosted staging smoke workflow is now live-verified in GitHub Actions against `https://staging.lightningclassics.com`
- the repo now also includes a matching hosted production smoke workflow plus a production secret-sync path
- the production GitHub secret-sync path is now live-verified through `npm run github:smoke:production:sync-secrets`
- the hosted production smoke workflow is now live-verified in GitHub Actions against `https://lightningclassics.com`
- the GitHub-hosted staging and production smoke workflows now self-bootstrap their dedicated smoke users at runtime, so the repository no longer needs stored smoke identifier or password secrets for those workflows
- the repo now also includes a GitHub OIDC operations-status workflow for staging and production
- the GitHub-hosted operations-status workflow is now live-verified for both staging and production
- the repo now also includes a GitHub OIDC cutover-evidence workflow plus `npm run github:ops:sync-secrets` to publish the required repository secret
- the cutover-evidence workflow is now live-verified in GitHub Actions and uploads a `cutover-evidence` artifact
- the hosted frontend stacks now also provision durable S3 archive buckets for retained releases:
  - `lightning-frontend-releases-staging-310505389001-eu-west-2`
  - `lightning-frontend-releases-prod-310505389001-eu-west-2`
- the repo now includes scripted hosted frontend archive listing, backfill sync, integrity verification, and redeploy commands for rollback, including remote S3 fallback when the local retained archive is missing
- the current hosted-frontend cutover runbook lives in `/Users/steve/Documents/GitHub/Lightning/docs/frontend-hosting-cutover.md`
- live DNS outputs as of 2026-04-02:
  - hosted zone ID `Z016489723I788PVTRF68`
  - `ns-999.awsdns-60.net`
  - `ns-1755.awsdns-27.co.uk`
  - `ns-269.awsdns-33.com`
  - `ns-1042.awsdns-02.org`

Deployment notes:

- `npm run deploy:local` now builds the backend first and then deploys the stack
- `npm run deploy:staging` and `npm run deploy:production` use the same shared stack model with safer non-local defaults
- non-local DynamoDB tables are now synthesized with deletion protection and `RETAIN` removal policy
- the production stack now enables CloudFormation termination protection
- the deployed stack emits `HttpApiUrl`, `PublicApiBaseUrl`, and `AuthApiBaseUrl`
- the deployed stack now also emits `PrivilegedApiBaseUrl`
- the deployed stack now also emits `CatalogModeratorGroupName`
- the deployed stack now also emits `EnvironmentName`, `ResourceSuffix`, and `SiteUrl`
- as of 2026-04-02, the deployed public/auth runtime has been live-verified with:
  - `GET /public/health`
  - `GET /public/books`
  - `GET /auth/me`
  - `GET /auth/favorites`
  - `PUT /auth/favorites/:bookId`
  - `DELETE /auth/favorites/:bookId`
- as of 2026-04-02, the deployed privileged runtime has been live-verified with:
  - `POST /privileged/book-suggestions/search`
  - `POST /privileged/book-suggestions/details`
  - `POST /privileged/book-suggestions/submit` for an authenticated user
  - `POST /privileged/book-suggestions/accept` returning `403` for an authenticated non-moderator
  - `GET /privileged/book-suggestions/submissions` with a real Cognito moderator token
  - `POST /privileged/book-suggestions/accept` returning `409 Conflict` for a known duplicate with a real Cognito moderator token
  - `POST /privileged/book-suggestions/defer` with moderator notes
  - `POST /privileged/book-suggestions/reject` with moderator notes
- as of 2026-04-02, browser-led deployed verification through the real frontend also covers:
  - comment create/delete
  - rating persistence
  - review create/delete
  - Add Book search/details
  - moderation queue visibility when `LIGHTNING_SMOKE_VERIFY_MODERATION=true`
  - automated temporary moderator elevation and cleanup when `LIGHTNING_SMOKE_AUTO_MODERATOR=true`
  - browser-led reject/defer moderation decisions against a deterministic synthetic submission
  - smoke runs using a repeatably bootstrapped Cognito user and seeded DynamoDB user-state baseline
- as of 2026-04-02, the first non-local staging stack has been deployed and browser-led staging verification passes through `npm run smoke:staging`
- as of 2026-04-02, the staging hosted frontend also passes browser-led verification through `npm run smoke:staging:hosted`
- as of 2026-04-02, the production pre-cutover stack has also been deployed and browser-led production verification passes through `npm run smoke:production`
- as of 2026-04-02, the production hosted frontend also passes browser-led verification through `npm run smoke:production:hosted`
- as of 2026-04-02, staging and production hosted frontends have both been republished through the environment-safe manual Amplify path and re-verified with browser smoke
- as of 2026-04-02, staging and production hosted release manifests both fetch successfully and match their expected stack outputs
- as of 2026-04-02, retained staging and production hosted frontend archives now exist locally with zip SHA-256 metadata
- as of 2026-04-02, the scripted retained-archive redeploy path has been live-verified against staging with hosted smoke passing afterward

Note:

- the repo-level bootstrap script in `/Users/steve/Documents/GitHub/Lightning/scripts/bootstrap-local-aws.mjs` now prefers CloudFormation outputs when `LightningLocalStack` exists and can refresh the `.env.local` files from the stack
- the repo-level bootstrap script now also supports `--ensure-smoke-user` for repeatable smoke-user confirmation and seeding
- the repo now includes a non-destructive ownership report at `/Users/steve/Documents/GitHub/Lightning/scripts/check-local-aws-ownership.mjs`
- the repo now includes a local DynamoDB backup export at `/Users/steve/Documents/GitHub/Lightning/scripts/export-local-dynamo-backup.mjs`
- the repo now also includes a local DynamoDB restore/import tool at `/Users/steve/Documents/GitHub/Lightning/scripts/restore-local-dynamo-backup.mjs`
- the current recommended hardening path for local is documented in `/Users/steve/Documents/GitHub/Lightning/docs/local-infrastructure-control.md`
- as of 2026-04-02, the local AWS resources have been recreated under `LightningLocalStack` and the ownership report returns `stack-managed`
- the privileged Add Book runtime is now deployed in the local stack
- the privileged auth/moderation policy is now fixed at authenticated submission plus moderator-only publication
- review environments remain intentionally ephemeral and are not modeled here as a long-lived fourth stack
- staging and production are now both live on their custom domains:
  - `https://staging.lightningclassics.com`
  - `https://lightningclassics.com`
- the production hosted frontend now also serves `https://www.lightningclassics.com` as a redirect to the canonical apex host
- the Route 53 hosted zone is now authoritative for `lightningclassics.com`
- the repo now also includes a script-backed domain delegation checker plus guarded domain-attachment helpers for staging and production
- the repo now also includes a script-backed custom-domain verification helper for staging and production
- the repo now also includes a guarded final cutover command that chains domain attachment, custom-host verification, and production CORS cleanup
- the repo now also includes hosted-frontend browser-smoke wrappers in `/Users/steve/Documents/GitHub/Lightning/scripts/run-hosted-frontend-smoke.mjs` so staged and production hosted URLs can be verified directly
- the repo now also includes `LightningGithubAutomationStack` for GitHub OIDC hosted-smoke access
- the repo now also includes `npm run github:smoke:staging:sync-secrets` and `npm run github:smoke:production:sync-secrets` so the required OIDC role secrets can be refreshed from live AWS outputs
- as of 2026-04-06, the hosted staging and production smoke workflows both pass in GitHub Actions without stored smoke identifier or password repository secrets
- the current secretless proof points are workflow runs:
  - staging `24050885863`
  - production `24050885734`
- the repo now also includes a pre-cutover backend CORS preparation helper so the default Amplify hosted URLs can complete authenticated browser smoke before custom-domain attachment
- the hosted-smoke preparation helper now also supports forced redeploys through:
  - `npm run prepare:staging:hosted-smoke:force`
  - `npm run prepare:production:hosted-smoke:force`
- the repo now also includes an optional post-cutover hosted browser-smoke stage inside the finalizer, and that stage now self-bootstraps environment-specific smoke users when credentials are not pre-supplied
- the repo now also includes a one-command operator cutover status report that combines delegation, hosted frontend, and CORS readiness
- the repo now also includes a wait-and-run cutover watcher that can poll DNS delegation and then hand off into the guarded finalizer automatically
- the repo now also includes a cutover evidence capture command for timestamped delegation, Amplify, HTTPS, CORS, and optional hosted-smoke proof snapshots
- the repo now also includes a GitHub-hosted cutover-evidence workflow that uploads the same JSON proof as an Actions artifact
- the repo now also includes a one-command completion wrapper that waits for delegation, finalizes the cutover, and captures post-cutover evidence automatically
- the repo now also includes an operations status report for staging and production plus a codified CloudWatch alarm and dashboard baseline
- the repo now also includes API Gateway access logs and active Lambda tracing in staging and production
- the repo now also includes one SNS alarm topic per long-lived cloud environment, with the codified alarms wired to those topics
- the guarded cutover finalizer now passes end to end with hosted browser smoke on both custom domains
- alarm email destinations can now be injected at deploy time with `LIGHTNING_ALARM_NOTIFICATION_EMAILS` or `--context alarmNotificationEmails=...`
- the repo now also includes `npm run ops:subscribe:emails` to apply alarm email destinations and then report the live SNS subscription state
- the repo now also includes `npm run ops:subscribe:emails:direct` to attach email subscriptions directly to the live SNS topics without a CDK deploy
- the repo now also includes `npm run github:alerting:sync-secrets` plus `.github/workflows/alarm-subscriptions.yml` so the direct live-topic alarm path can also run from GitHub Actions through a dedicated alerting-management OIDC role
- current access-log groups are:
  - `/aws/apigateway/lightning-http-api-access-staging`
  - `/aws/apigateway/lightning-http-api-access-prod`
- current alarm topics are:
  - `lightning-operations-alerts-staging`
  - `lightning-operations-alerts-prod`
- the shared `CDKToolkit` bootstrap stack in `eu-west-2` was also updated during the observability rollout so the deploy role can apply the current stack model
- as of 2026-04-02, `npm run ops:status` reports:
  - staging public health `200`
  - production public health `200`
  - all staging alarms `OK`
  - all production alarms `OK`
  - complete alarm-action coverage in both environments
  - alarm-subscription readiness now reflects the lack of confirmed live destinations until at least one subscription is confirmed
- as of 2026-04-02, hosted browser smoke still passes after the observability rollout on:
  - `https://staging.dy2grocxp5fe9.amplifyapp.com`
  - `https://main.d1te9vk2z7t41u.amplifyapp.com`

To attach notification emails on a future deploy:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run deploy:staging
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run deploy:production:precutover
```

Preferred operator path:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run ops:subscribe:emails -- --dry-run
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run ops:subscribe:emails
```

This wrapper now deploys the alarm-email change for both long-lived cloud environments and prints the post-deploy SNS readiness state so `PendingConfirmation` is obvious.

Direct live-topic operator path:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run ops:subscribe:emails:direct -- --dry-run
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_ALARM_NOTIFICATION_EMAILS=ops@example.com /usr/local/bin/npm run ops:subscribe:emails:direct
```

This path attaches email subscriptions directly to the live staging and production SNS topics, skips existing subscriptions, and immediately reruns `ops:status` so the confirmed or pending state is visible without a stack deploy.

GitHub Actions alert-subscription path:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:alerting:sync-secrets -- --dry-run
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:alerting:sync-secrets
```

This path now:

- publishes `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_ALERTING` from `LightningGithubAutomationStack`
- enables the manual `.github/workflows/alarm-subscriptions.yml` workflow
- lets the workflow use either a manual `emails` input or the repository secret `LIGHTNING_ALARM_NOTIFICATION_EMAILS`
- supports a dry-run first pass so the AWS/GitHub wiring can be verified without creating SNS subscriptions
- writes a GitHub job summary plus uploaded artifacts for both the raw subscription JSON and a human-readable readiness summary
- includes the current per-environment `ops:status` alert-readiness snapshot even in dry-run mode
- has now been live-verified in GitHub Actions on 2026-04-06 through workflow run `24052959607` in dry-run mode

GitHub Actions frontend-release path:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:frontend:release:sync-secrets -- --dry-run
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run github:frontend:release:sync-secrets
```

This path now:

- publishes `LIGHTNING_GITHUB_ACTIONS_ROLE_ARN_FRONTEND_RELEASE` from `LightningGithubAutomationStack`
- enables the manual `.github/workflows/frontend-release.yml` workflow
- keeps the GitHub release path aligned with the local operator path by running the same manual Amplify publish script
- immediately verifies the live release manifest after publish
- then re-assumes the target environment’s hosted-smoke role and runs the real browser smoke as part of the same workflow
- safely bootstraps smoke users even when the generated password begins with `-`, by passing AWS CLI password arguments in `--flag=value` form
- has now been live-verified in GitHub Actions on 2026-04-06 through:
  - staging run `24052374191`
  - production run `24052639174`
