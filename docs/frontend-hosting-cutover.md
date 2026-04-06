# Lightning Classics Frontend Hosting Cutover

## Status

This runbook covers the AWS-hosted frontend delivery path for Lightning Classics.

As of 2026-04-06:

- the Route 53 DNS stack is deployed as `LightningDnsStack`
- the Amplify staging and production hosting stacks are codified and synth cleanly
- the hosted frontend stacks support both `MANUAL` artifact deployment and `REPOSITORY` deployment
- the staging hosted frontend stack is live as `LightningStagingFrontendStack`
- the staging Amplify app is deployed in `MANUAL` mode and currently serves from the default Amplify domain
- the production hosted frontend stack is live as `LightningProductionFrontendStack`
- the production Amplify app is deployed in `MANUAL` mode and currently serves from the default Amplify domain
- staging and production custom-domain associations are live
- `www.lightningclassics.com` now redirects to `https://lightningclassics.com/`

Live DNS outputs as of 2026-04-02:

- hosted zone ID `Z016489723I788PVTRF68`
- nameserver 1 `ns-999.awsdns-60.net`
- nameserver 2 `ns-1755.awsdns-27.co.uk`
- nameserver 3 `ns-269.awsdns-33.com`
- nameserver 4 `ns-1042.awsdns-02.org`

## Stack Inventory

The repo now defines:

- `LightningDnsStack`
- `LightningStagingFrontendStack`
- `LightningProductionFrontendStack`

Current hosted-frontend naming baseline:

- Amplify app `lightning-frontend-staging`
- Amplify app `lightning-frontend-prod`

Current live staging hosted-frontend outputs:

- stack id `LightningStagingFrontendStack`
- Amplify app ID `dy2grocxp5fe9`
- default domain `dy2grocxp5fe9.amplifyapp.com`
- hosted staging URL `https://staging.dy2grocxp5fe9.amplifyapp.com`
- deployment mode `MANUAL`

Current live production hosted-frontend outputs:

- stack id `LightningProductionFrontendStack`
- Amplify app ID `d1te9vk2z7t41u`
- default domain `d1te9vk2z7t41u.amplifyapp.com`
- hosted production URL `https://main.d1te9vk2z7t41u.amplifyapp.com`
- deployment mode `MANUAL`
- redirect alias `https://www.lightningclassics.com`

Current branch baseline:

- staging branch `staging`
- production branch `main`

Current custom-domain baseline:

- staging `staging.lightningclassics.com`
- production `lightningclassics.com`
- production redirect alias `www.lightningclassics.com -> https://lightningclassics.com/`

## Deploy Order

### 1. Create the hosted zone

Run:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run deploy:dns
```

Expected outputs:

- `HostedZoneId`
- `HostedZoneNameServers`
- `HostedZoneNameServer1`
- `HostedZoneNameServer2`
- `HostedZoneNameServer3`
- `HostedZoneNameServer4`

The four nameserver outputs are the exact values to set at the domain registrar for `lightningclassics.com`.

### 2. Point the registrar at Route 53

After `LightningDnsStack` is deployed:

- copy the four `HostedZoneNameServer*` outputs
- update the registrar for `lightningclassics.com`
- wait for delegation to settle before attaching the custom domain in Amplify

Readiness check:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run check:domain:delegation
```

The cutover should only proceed once `delegationMatches` is `true`.

Operator status report:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run cutover:status
```

This report prints:

- the current registrar nameservers
- the expected Route 53 nameservers
- the live staging and production hosted URLs
- any configured production redirect aliases such as `www.lightningclassics.com`
- the current CORS allow-lists for staging and production
- whether cutover already appears complete
- the final cutover command to run once delegation is ready, when cutover is not already complete

Evidence capture:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run cutover:evidence
```

Optional browser-level evidence:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run cutover:evidence:with-hosted-smoke
```

These commands collect a timestamped cutover snapshot for:

- registrar delegation
- Amplify custom-domain association state
- HTTPS reachability for the default Amplify and custom-domain hosts
- backend CORS allow-lists
- optional hosted browser smoke results

The local hosted smoke wrappers now also self-bootstrap dedicated environment-specific smoke users when `LIGHTNING_SMOKE_IDENTIFIER` and `LIGHTNING_SMOKE_PASSWORD` are absent.
That keeps local hosted verification independent from the GitHub repository secret set.

Current evidence status on 2026-04-02:

- `npm run cutover:evidence` now passes against the live pre-cutover state
- both default Amplify frontends return `200` for root and `favicon.svg`
- custom-domain HTTPS probes are intentionally skipped until Amplify reports the custom domains as available

If you want to persist the JSON snapshot into the repo archive during an operator handoff:

```sh
/usr/local/bin/npm run cutover:evidence -- --output /Users/steve/Documents/GitHub/Lightning/docs/archive/cutover-evidence/cutover-evidence.json
```

Optional wait-and-run path:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run cutover:wait-and-finalize:with-hosted-smoke
```

This watcher:

- polls registrar delegation until it matches the Route 53 hosted zone
- runs the guarded cutover finalizer automatically once delegation is ready
- can be rehearsed safely with `-- --dry-run`

One-command completion path:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run cutover:complete:with-hosted-smoke
```

This wraps the watcher and then captures a post-cutover evidence snapshot after the finalizer succeeds.

### 3. Deploy staging frontend hosting stack

Manual-mode baseline:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run deploy:frontend:staging
```

Repository-connected mode remains available when GitHub access is ready:

```sh
/usr/local/bin/npm run deploy:frontend:staging -- \
  --parameters AmplifyDeploymentMode=REPOSITORY \
  --parameters AmplifyAccessToken=YOUR_GITHUB_TOKEN \
  --parameters EnableCustomDomainAssociation=true
```

Optional custom-certificate path:

```sh
/usr/local/bin/npm run deploy:frontend:staging -- \
  --parameters AmplifyDeploymentMode=REPOSITORY \
  --parameters AmplifyAccessToken=YOUR_GITHUB_TOKEN \
  --parameters EnableCustomDomainAssociation=true \
  --parameters AmplifyCustomCertificateArn=arn:aws:acm:us-east-1:...
```

Notes:

- `AmplifyRepositoryUrl` defaults to `https://github.com/mutantnewt/Lightning`
- `AmplifyDeploymentMode=MANUAL` is now the default so the hosted app can be deployed without GitHub repository access
- leave `AmplifyCustomCertificateArn` blank to use Amplify-managed certificates
- if `EnableCustomDomainAssociation=false`, the stack still prepares the Amplify app and branch but does not attach the custom domain

### 4. Upload a staging frontend artifact

Run from `literary-light/`:

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
/usr/local/bin/npm run deploy:staging:manual-amplify
```

Current verification status:

- the latest staging manual artifact deployment succeeded on 2026-04-02
- the latest staging manual artifact refresh succeeded on 2026-04-02 with Amplify job `8`
- the manual-deploy packaging bug was fixed by archiving the contents of `dist/` at the zip root, not the parent `dist` folder
- the manual-deploy build path now injects environment-specific frontend values directly from `LightningStagingFrontendStack` outputs instead of relying on developer-local `.env.local`
- the manual-deploy path now also publishes a release manifest at `https://staging.dy2grocxp5fe9.amplifyapp.com/lightning-release.json`
- the manual-deploy path now also retains a local rollback archive under `.local/frontend-releases/staging/<releaseId>/`
- the latest retained staging release archive is now also uploaded to `s3://lightning-frontend-releases-staging-310505389001-eu-west-2/releases/<releaseId>/`
- the hosted staging URL now returns `HTTP/2 200`
- the hosted staging favicon asset now returns `HTTP/2 200` at `https://staging.dy2grocxp5fe9.amplifyapp.com/favicon.svg`
- the hosted staging root now also returns the codified `Content-Security-Policy` and `Cross-Origin-Resource-Policy` headers
- hosted staging browser smoke passes after the environment-safe manual republish on 2026-04-02

### 5. Verify staging hosted frontend

Verify:

- Amplify branch deployment completes
- staging default Amplify domain responds at `https://staging.dy2grocxp5fe9.amplifyapp.com`
- `staging.lightningclassics.com` responds after DNS and certificate propagation
- the existing browser-led staging smoke still passes against the live staging backend
- the hosted browser smoke now also exists at `npm run smoke:staging:hosted` and can target the hosted frontend directly
- staging pre-cutover backend CORS now also allows `https://staging.dy2grocxp5fe9.amplifyapp.com`
- browser-led hosted staging verification now passes through `npm run smoke:staging:hosted`
- the hosted staging manual publish path is now environment-safe because it resolves Cognito IDs, API base URLs, moderator group name, and `VITE_SITE_URL` from stack outputs for the selected environment
- operator release verification is now available through `npm run frontend:release:status:staging`
- operator archive inventory is now available through `npm run frontend:release:archives:staging`
- operator archive inventory now reports both local and remote storage presence for the newest staging release
- remote-only restore is now live-verified on staging by redeploying from an empty `LIGHTNING_FRONTEND_RELEASE_ARCHIVE_ROOT` and downloading the retained zip plus metadata from S3 before publish

Pre-cutover hosted frontend note:

- browser-led smoke against the default Amplify frontend host requires the backend CORS allow-list to include that Amplify hostname while the custom domain is still pending
- the repo now includes `/usr/local/bin/npm run prepare:staging:hosted-smoke` and `/usr/local/bin/npm run prepare:production:hosted-smoke` in `infra/` for that temporary pre-cutover backend allowance
- if hosted smoke fails with browser `Failed to fetch` errors from the default Amplify domain, re-run `/usr/local/bin/npm run prepare:staging:hosted-smoke:force` or `/usr/local/bin/npm run prepare:production:hosted-smoke:force` and confirm the API again returns `Access-Control-Allow-Origin` for the relevant Amplify hostname
- the final production cutover flow removes those temporary pre-cutover origins again

### 5a. Attach the custom domains after delegation

Once the readiness check confirms the registrar is using the Route 53 nameservers:

Attach both long-lived domains:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run deploy:frontend:domains
```

Or attach just one environment:

```sh
/usr/local/bin/npm run deploy:frontend:staging:domain
```

```sh
/usr/local/bin/npm run deploy:frontend:production:domain
```

These commands:

- re-deploy the hosted-frontend stack with `EnableCustomDomainAssociation=true`
- refuse to proceed unless the registrar delegation already matches the Route 53 hosted zone, unless explicitly overridden
- print the Amplify domain-association outputs so the cutover can be tracked without manual stack inspection

### 5b. Verify the attached domains

After the domain-association deploy starts, verify both long-lived custom hosts:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run verify:frontend:domains -- --wait --require-ready
```

Or verify one host at a time:

```sh
/usr/local/bin/npm run verify:frontend:staging:domain -- --wait --require-ready
```

```sh
/usr/local/bin/npm run verify:frontend:production:domain -- --wait --require-ready
```

These commands check:

- registrar delegation still matches the Route 53 hosted zone
- Amplify domain-association status is available
- the custom hostname responds over HTTPS
- the custom hostname serves `/favicon.svg`
- the production redirect alias, when present, resolves over HTTPS and lands on the canonical apex domain

Browser-level hosted verification:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run prepare:staging:hosted-smoke
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run prepare:production:hosted-smoke
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
LIGHTNING_SMOKE_IDENTIFIER=lightning-staging-smoke@example.com \
LIGHTNING_SMOKE_PASSWORD='your-staging-smoke-password' \
/usr/local/bin/npm run smoke:staging:hosted
```

```sh
LIGHTNING_SMOKE_IDENTIFIER=lightning-production-smoke@example.com \
LIGHTNING_SMOKE_PASSWORD='your-production-smoke-password' \
/usr/local/bin/npm run smoke:production:hosted
```

```sh
LIGHTNING_SMOKE_IDENTIFIER=lightning-production-smoke@example.com \
LIGHTNING_SMOKE_PASSWORD='your-production-smoke-password' \
/usr/local/bin/npm run smoke:production:hosted:www
```

These commands use the default Amplify domain until the custom domain is attached and verified, then prefer the custom domain automatically.
The dedicated production `www` variant starts on `https://www.lightningclassics.com`, verifies the redirect lands on `https://lightningclassics.com`, and then continues the normal hosted smoke on the canonical apex host.

### 5c. Finalize the cutover

Once delegation is live and the team wants a single guarded command:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run cutover:finalize
```

This command:

- attaches both hosted domains if they are not already attached
- waits for the staging and production custom hosts to become healthy
- re-runs the production backend deploy without the pre-cutover localhost override
- verifies that `http://127.0.0.1:5175` is no longer present in `LightningProductionStack` `CorsAllowedOrigins`
- verifies that the default Amplify production hostname is no longer present in `LightningProductionStack` `CorsAllowedOrigins`

Optional browser-level post-cutover verification:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
LIGHTNING_STAGING_SMOKE_IDENTIFIER=lightning-staging-smoke@example.com \
LIGHTNING_STAGING_SMOKE_PASSWORD='your-staging-smoke-password' \
LIGHTNING_PRODUCTION_SMOKE_IDENTIFIER=lightning-production-smoke@example.com \
LIGHTNING_PRODUCTION_SMOKE_PASSWORD='your-production-smoke-password' \
/usr/local/bin/npm run cutover:finalize:with-hosted-smoke
```

That variant runs the same guarded cutover flow and then executes hosted browser smoke against:

- `https://staging.lightningclassics.com`
- `https://lightningclassics.com`

using `--target custom-domain`.

Safe rehearsal:

```sh
/usr/local/bin/npm run cutover:finalize -- --dry-run
```

Or rehearse the wait-and-run wrapper:

```sh
/usr/local/bin/npm run cutover:wait-and-finalize:with-hosted-smoke -- --dry-run
```

Or rehearse the full completion path:

```sh
/usr/local/bin/npm run cutover:complete:with-hosted-smoke -- --dry-run
```

### 6. Deploy production backend and frontend

Pre-cutover production baseline:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run deploy:production:precutover
```

```sh
/usr/local/bin/npm run deploy:frontend:production:precutover
```

```sh
cd /Users/steve/Documents/GitHub/Lightning/literary-light
/usr/local/bin/npm run deploy:production:manual-amplify
```

Current verification status:

- production backend stack `LightningProductionStack` is live
- production API base URL is `https://ejyo5np488.execute-api.eu-west-2.amazonaws.com`
- production user pool ID is `eu-west-2_Pi9wmd5S9`
- production app client ID is `7nhs7brc3dphqg1dlaovinlbar`
- production default Amplify URL returns `HTTP/2 200` at `https://main.d1te9vk2z7t41u.amplifyapp.com`
- production favicon returns `HTTP/2 200` at `https://main.d1te9vk2z7t41u.amplifyapp.com/favicon.svg`
- packaged browser verification now passes through `npm run smoke:production`
- production pre-cutover backend CORS now also allows `https://main.d1te9vk2z7t41u.amplifyapp.com`
- browser-led hosted production verification now passes through `npm run smoke:production:hosted`
- the manual production republish path now injects environment-specific frontend values directly from `LightningProductionFrontendStack` outputs instead of relying on developer-local `.env.local`
- the manual production path now also publishes a release manifest at `https://main.d1te9vk2z7t41u.amplifyapp.com/lightning-release.json`
- the manual production path now also retains a local rollback archive under `.local/frontend-releases/production/<releaseId>/`
- the latest retained production release archive is now also uploaded to `s3://lightning-frontend-releases-prod-310505389001-eu-west-2/releases/<releaseId>/`
- the hosted production root now also returns the codified `Content-Security-Policy` and `Cross-Origin-Resource-Policy` headers
- hosted production browser smoke passes again after the environment-safe manual republish on 2026-04-02
- hosted custom-domain browser smoke now also passes on 2026-04-03 for:
  - `https://staging.lightningclassics.com`
  - `https://lightningclassics.com`
- the production hosted-frontend stack now also outputs `FrontendRedirectAliasDomainName = www.lightningclassics.com`
- `https://www.lightningclassics.com` now returns `301` to `https://lightningclassics.com/` with the same hosted security-header baseline
- `npm run smoke:production:hosted:www` now also passes live on 2026-04-06
- the GitHub-hosted production smoke workflow now also verifies the `www` redirect path in CI as part of the same production smoke run
- workflow run `24048137450` passed on 2026-04-06 and is the current GitHub-hosted proof point for both production apex and `www` redirect smoke

Repository-connected mode remains available later:

```sh
/usr/local/bin/npm run deploy:production
```

```sh
/usr/local/bin/npm run deploy:frontend:production -- \
  --parameters AmplifyDeploymentMode=REPOSITORY \
  --parameters AmplifyAccessToken=YOUR_GITHUB_TOKEN \
  --parameters EnableCustomDomainAssociation=true
```

Optional custom-certificate path:

```sh
/usr/local/bin/npm run deploy:frontend:production -- \
  --parameters AmplifyDeploymentMode=REPOSITORY \
  --parameters AmplifyAccessToken=YOUR_GITHUB_TOKEN \
  --parameters EnableCustomDomainAssociation=true \
  --parameters AmplifyCustomCertificateArn=arn:aws:acm:us-east-1:...
```

Important pre-cutover note:

- `deploy:production:precutover` deliberately includes `http://127.0.0.1:5175` in the production API CORS allow-list so the packaged browser smoke can verify production before DNS cutover
- after `lightningclassics.com` is delegated into Route 53 and attached in Amplify, re-run `/usr/local/bin/npm run deploy:frontend:production` without the pre-cutover override to remove the temporary localhost production CORS allowance while keeping the frontend stack in the same CDK graph
- the repo now includes `/Users/steve/Documents/GitHub/Lightning/scripts/check-domain-cutover-readiness.mjs` and `/Users/steve/Documents/GitHub/Lightning/scripts/attach-hosted-frontend-domains.mjs` so the attach and cleanup sequence is explicit and repeatable
- the repo now also includes `/Users/steve/Documents/GitHub/Lightning/scripts/verify-hosted-frontend-domains.mjs` so post-attach health can be confirmed before production lock-down
- the repo now also includes `/Users/steve/Documents/GitHub/Lightning/scripts/finalize-hosted-domain-cutover.mjs` so the full post-delegation attach, verify, and production lock-down flow can run as one guarded operation
- the repo now also includes `/Users/steve/Documents/GitHub/Lightning/scripts/prepare-hosted-frontend-cors.mjs` so the default Amplify hosted frontend can complete authenticated browser smoke before custom-domain cutover
- `/usr/local/bin/npm run prepare:staging:hosted-smoke:force` and `/usr/local/bin/npm run prepare:production:hosted-smoke:force` now exist for backend-only refreshes where the hosted frontend URL is already present in CORS but the stack still needs to be redeployed
- the finalizer can now also run browser-level hosted smoke on the actual custom domains when the environment-specific smoke credentials are supplied
- the repo now also includes `/Users/steve/Documents/GitHub/Lightning/scripts/wait-for-domain-cutover.mjs` so the registrar propagation window can be polled and handed off into the guarded finalizer automatically
- the repo now also includes `/Users/steve/Documents/GitHub/Lightning/scripts/complete-domain-cutover.mjs` so the full watcher, finalizer, and post-cutover evidence capture can run as one operator command

Post-cutover live status on 2026-04-06:

- registrar delegation now matches the Route 53 hosted zone
- `staging.lightningclassics.com` is attached and serving over HTTPS
- `lightningclassics.com` is attached and serving over HTTPS
- `www.lightningclassics.com` now redirects over HTTPS to `https://lightningclassics.com/`
- `npm run cutover:finalize:with-hosted-smoke` completed successfully
- the original post-cutover evidence snapshot remains archived at `/Users/steve/Documents/GitHub/Lightning/docs/archive/cutover-evidence/cutover-evidence-2026-04-03T08-41-30Z.json`
- a refreshed post-cutover evidence snapshot is now archived at `/Users/steve/Documents/GitHub/Lightning/docs/archive/cutover-evidence/cutover-evidence-2026-04-06T19-54-10Z.json`
- production CORS is now locked to `https://lightningclassics.com` only
- the hosted cutover run exposed and fixed two real-world issues:
  - domain attachment parameters had to be stack-scoped to the frontend stacks
  - the post-cutover production cleanup deploy had to use `deploy:frontend:production`, not `deploy:production`, to avoid cross-stack export rollback
- the apex-domain verifier now treats `domainStatus=AVAILABLE` plus successful HTTPS as authoritative readiness, because Amplify keeps the root subdomain `verified` flag false even while the live host is healthy
- the refreshed evidence snapshot confirms `goLiveReady = true` and that the final production CORS allow-list contains only `https://lightningclassics.com`
- the hosted-domain verifier now also treats the production `www` alias as part of the healthy final state by requiring it to redirect to the canonical apex host

## Certificate Rule

The current default is:

- Amplify-managed certificate for the hosted frontend custom domain

If a project or account policy requires a custom certificate:

- request or import the certificate in `us-east-1`
- pass that ARN through `AmplifyCustomCertificateArn`

This matches Amplify Hosting’s certificate requirement for custom ACM certificates.

## Security Baseline

The hosted frontend stack now bakes in:

- explicit Vite build settings for `literary-light/`
- SPA rewrite rules for client-side routing
- no-cookie cache configuration via `AMPLIFY_MANAGED_NO_COOKIES`
- environment-safe manual artifact publishing by resolving the selected frontend stack outputs into the Vite build environment
- a machine-readable release manifest at `/lightning-release.json` for operator verification and rollback tracing
- baseline hosted security headers:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Resource-Policy`

Current CSP baseline:

- `default-src 'self'`
- `script-src 'self'`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `font-src 'self' data: https://fonts.gstatic.com`
- `img-src 'self' data: https://covers.openlibrary.org`
- `connect-src` limited to:
  - the workload-region API Gateway host pattern
  - the environment site origin
  - Cognito IdP in `eu-west-2`
  - the current public dependency origins the app still uses

Hosted release verification:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:status
```

This verifies that the hosted release manifest fetched from the live Amplify URL still matches the expected stack outputs for:

- environment name
- API base URL
- site URL
- Cognito user-pool ID
- Cognito app-client ID
- catalog moderator group name

Hosted release rollback:

```sh
cd /Users/steve/Documents/GitHub/Lightning/infra
/usr/local/bin/npm run frontend:release:archives
```

```sh
/usr/local/bin/npm run frontend:release:sync
```

```sh
/usr/local/bin/npm run frontend:release:verify
```

```sh
/usr/local/bin/npm run frontend:release:redeploy:staging -- --release-id <release-id>
```

```sh
/usr/local/bin/npm run frontend:release:redeploy:production -- --release-id <release-id>
```

The redeploy command now resolves archives in this order:

- local retained archive under `.local/frontend-releases/<environment>/<releaseId>/`
- remote retained archive in the environment-specific S3 bucket if the local copy is missing

Current archive buckets:

- staging `lightning-frontend-releases-staging-310505389001-eu-west-2`
- production `lightning-frontend-releases-prod-310505389001-eu-west-2`
- both buckets now also share the same lifecycle baseline:
  - abort incomplete multipart uploads after `7` days
  - transition retained `releases/` objects to `INTELLIGENT_TIERING` after `30` days
  - expire noncurrent object versions after `90` days
  - keep current retained release archives available for rollback

Current verification status:

- retained staging and production release archives now exist under `/Users/steve/Documents/GitHub/Lightning/.local/frontend-releases/`
- all retained staging and production releases now also have durable remote copies in their environment-specific S3 archive buckets
- `npm run frontend:release:sync` now backfills any retained local-only archives into the matching S3 archive bucket without republishing the frontend
- `npm run frontend:release:archives` now reports `storagePresence.local` and `storagePresence.remote`
- `npm run frontend:release:verify` now confirms the retained S3 metadata and downloaded zip payloads still match the recorded archive SHA-256 values
- the scripted archive redeploy path has now been live-verified in both staging and production from empty temporary archive roots, which forced the restore path to download the retained zip and metadata from S3 before redeploying
- staging hosted browser smoke passes again after the remote-archive redeploy
- production hosted browser smoke also passes after the remote-archive redeploy
- staging and production hosted verification both surfaced pre-cutover default-Amplify CORS drift on 2026-04-02 and the codified recovery path was verified with:
  - `/usr/local/bin/npm run prepare:staging:hosted-smoke:force`
  - `/usr/local/bin/npm run prepare:production:hosted-smoke:force`
  - `curl -s -i -H 'Origin: https://staging.dy2grocxp5fe9.amplifyapp.com' https://pbs76ug4gc.execute-api.eu-west-2.amazonaws.com/public/books`
  - `curl -s -i -H 'Origin: https://main.d1te9vk2z7t41u.amplifyapp.com' https://ejyo5np488.execute-api.eu-west-2.amazonaws.com/public/books`
  - `/usr/local/bin/npm run smoke:staging:hosted`
  - `/usr/local/bin/npm run smoke:production:hosted`

The hosted frontend stack does not weaken the existing no-cookie auth rule.

## Current Limitation

The repo now codifies the frontend hosting path, but it does not yet:

- attach the live custom domain
- complete registrar delegation for `lightningclassics.com`
- switch the staging or production frontend over to repository-connected Amplify CI/CD
- remove the temporary production localhost CORS allowance that exists only for pre-cutover smoke verification
