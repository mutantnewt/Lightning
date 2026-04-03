# Lightning Classics Incident And Rollback Runbook

## Purpose

This runbook is the short response path for staging or production incidents.

It covers:

- first-response steps
- common incident classes
- rollback paths
- minimum verification after recovery
- evidence to capture

## First Response

1. Confirm impact.

- Check whether the incident is `staging`, `production`, or both.
- Run:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run ops:status
```

2. Confirm whether the failure is frontend, backend, or cutover-related.

- If the frontend is suspected, run the hosted smoke for the affected environment.
- If the backend is suspected, inspect the public health endpoint and CloudWatch alarm state.
- If the issue happened during domain cutover, also run `cutover:evidence`.

3. Preserve evidence before changing too much.

- capture `ops:status`
- capture `cutover:evidence` if DNS/custom-domain behavior is involved
- note the impacted URL, approximate start time, and failing user journey

## Common Incident Classes

### Hosted frontend failure

Signals:

- default Amplify host or custom domain returns non-`200`
- hosted browser smoke fails before API calls begin

First actions:

- confirm the current Amplify host status
- confirm whether the issue affects only the custom domain or also the default Amplify domain
- if the default Amplify domain is healthy but the custom domain is not, treat this as a cutover/domain incident first

### Backend runtime failure

Signals:

- `ops:status` shows failed public health
- one or more Lambda or HTTP API alarms move to `ALARM`
- browser smoke fails after sign-in or during data fetch

First actions:

- identify which surface is failing:
  - public
  - authenticated
  - privileged
- inspect the matching CloudWatch log group and recent Lambda errors
- inspect the matching API Gateway access log group if the symptoms point to CORS, route matching, or authorizer behavior
- use X-Ray traces when you need to distinguish Lambda runtime failure from API-edge failure

### Cutover or DNS incident

Signals:

- custom domains fail while default Amplify hosts still work
- Route 53 delegation does not match
- Amplify domain association is not `AVAILABLE`

First actions:

- run:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run cutover:status
```

- if delegation is wrong, fix registrar nameservers before doing anything else
- if delegation is right but domain association is still incomplete, wait or re-run the guarded cutover path rather than improvising manual changes

## Rollback Paths

### Frontend rollback

Preferred path:

- list retained release archives for the affected environment
- redeploy the chosen retained release artifact back into the matching Amplify app

Current commands:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:archives
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:sync
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:verify
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:redeploy:staging -- --release-id <release-id>
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:redeploy:production -- --release-id <release-id>
```

Current retained-artifact baseline:

- retained frontend release archives are stored locally under `/Users/steve/Documents/GitHub/Lightning/.local/frontend-releases/<environment>/<releaseId>/`
- the newest retained releases are also stored remotely in the environment-specific S3 archive buckets:
  - staging `lightning-frontend-releases-staging-310505389001-eu-west-2`
  - production `lightning-frontend-releases-prod-310505389001-eu-west-2`
- each retained release includes:
  - the original uploaded frontend zip
  - `release-archive.json`
  - release SHA-256 for the zip payload
- the live hosted frontend continues to expose `/lightning-release.json` for post-rollback verification
- `frontend:release:sync` now backfills any retained local-only archives into the matching environment S3 archive bucket
- `frontend:release:verify` now downloads the retained remote zips and confirms their SHA-256 values still match the recorded release metadata
- `frontend:release:redeploy:<environment>` now restores from S3 automatically if the local retained archive is missing
- the remote-restore redeploy path has now been live-rehearsed in both staging and production

### Backend rollback

Preferred path:

- redeploy the previously known-good CDK state for the affected stack
- if the live issue is production and custom-domain cutover has not completed, preserve the current pre-cutover frontend-origin allowances by using the pre-cutover production deploy path

Current commands:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run deploy:staging
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run deploy:production:precutover
```

### Cutover rollback

If custom-domain cutover fails after attachment:

- prefer the default Amplify domains as the emergency fallback verification path
- use `cutover:status` and `cutover:evidence` to determine whether the issue is:
  - registrar delegation
  - Amplify domain association
  - production CORS cleanup

Do not improvise by weakening auth or permanently adding extra origins beyond the documented pre-cutover allowances.

## Minimum Verification After Recovery

After any recovery or rollback, verify:

1. `ops:status` shows healthy public health and no active alarms for the affected environment.
2. `ops:status` shows `alarmActionCoverage.complete` for the affected environment.
3. `ops:status` shows `alarmSubscriptionReadiness.ready` for the affected environment.
4. The affected browser smoke path passes.
5. `frontend:release:status` shows the hosted release manifest matches the expected stack outputs.
6. If domains were involved, `cutover:evidence` reflects the intended state.
7. If production was touched, confirm temporary origins in CORS are only present when deliberately using the documented pre-cutover path.

## Evidence To Capture

Minimum evidence set:

- time the incident started or was first observed
- impacted environment and URL
- `ops:status` output
- `cutover:evidence` output when domains or CORS are involved
- relevant CloudWatch alarm names and states
- relevant Lambda log excerpts or error summaries
- hosted frontend `/lightning-release.json` for the affected environment when frontend rollback is involved
- exact deployment or rollback command used

## Known Future Improvements

- attach subscriptions and escalation routing on top of the existing environment SNS alarm topics
- add lifecycle, replication, or cross-account protection on top of the remote hosted-frontend archive buckets
