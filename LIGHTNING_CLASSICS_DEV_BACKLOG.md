# LIGHTNING CLASSICS — Developer Backlog (Micro‑steps + Tests)
_AWS‑only pipeline to build and release a complete “Reader’s Edition” book across EPUB, Kindle, Print PDF, Large‑Print, Audiobook, and Braille, with testing after every step._

**Authoring conventions**
- **MS x.y** = Micro‑Step number.
- Each step lists: **Goal • Deliverables • Implementation • Acceptance Tests • Rollback**.
- Infra is in **AWS CDK (TypeScript)** with one repo `lightning-classics/` containing `/infra`, `/lambdas`, `/containers`, `/tests`.
- Use **dev → stage → prod** accounts. Each feature merges into `dev`, then promoted.
- Default region: `eu-west-2`. All S3 buckets with **KMS, versioning, BPA on**.

---

## PHASE 0 — Project Skeleton & Guardrails

### MS 0.1 — Bootstrap mono‑repo & CI
**Goal**: Working repo with CI and CDK deploy.
- **Deliverables**: GitHub repo; `infra/` CDK app; GitHub Actions CI for lint, unit tests, `cdk synth`.
- **Implementation**:
  - `cdk init app --language typescript` in `/infra`.
  - Configure `tsconfig.json`, ESLint, Prettier.
  - Add GitHub Action with Node 20, `npm ci`, `npm run build`, `cdk synth`.
- **Acceptance Tests**:
  - CI green on push.
  - `cdk synth` emits template without errors.
- **Rollback**: Revert commit.

### MS 0.2 — Core S3 buckets + KMS
**Goal**: Secure storage layout.
- **Deliverables**:
  - Buckets: `lc-work`, `lc-release`, `lc-logs` with KMS, versioning, lifecycle (Glacier after 90d for `work`).
- **Implementation**: CDK `s3.Bucket` with `blockPublicAccess`, `encryption: KMS`, `serverAccessLogsBucket` → `lc-logs`.
- **Acceptance Tests**:
  - `aws s3api get-bucket-encryption` shows SSE-KMS.
  - `BlockPublicAcls: true` etc.
- **Rollback**: `cdk destroy` stack (dev).

### MS 0.3 — DynamoDB tables
**Goal**: Persist books, editions, jobs, isbns, artifacts.
- **Deliverables**: Tables
  - `Books(pk=bookId)`
  - `Editions(pk=editionId, sk=bookId)`
  - `Jobs(pk=jobId)`
  - `ISBNs(pk=bookId, sk=format)`
  - `Artifacts(pk=artifactId, sk=editionId)`
- **Implementation**: CDK `dynamodb.Table` PAY_PER_REQUEST. PITR on.
- **Acceptance Tests**: `describe-table` shows `PointInTimeRecoveryDescription.Status` = ENABLED.
- **Rollback**: Destroy stack (dev).

### MS 0.4 — Eventing & Observability
**Goal**: Baseline logs/metrics/tracing.
- **Deliverables**: CloudWatch log groups, Metrics dashboard, X‑Ray enabled for Lambdas/Step Functions.
- **Implementation**: CDK for log retention 90d, X‑Ray on Lambdas.
- **Acceptance Tests**: Invoke any test Lambda → logs present; X‑Ray traces visible.
- **Rollback**: Remove X‑Ray from dev if noisy.

---

## PHASE 1 — Walking Skeleton State Machine

### MS 1.1 — State machine scaffold
**Goal**: Standard Step Functions with echo Lambdas.
- **Deliverables**: `MakeBookStateMachine` with placeholder tasks.
- **Implementation**: CDK `sfn.StateMachine` + 6–8 `lambda.Function` that return input.
- **Acceptance Tests**:
  - `StartExecution` with sample job JSON → succeeds; output contains same payload plus `traceId`.
- **Rollback**: Revert stack.

### MS 1.2 — Job schema & strict validation
**Goal**: Canonical job input schema.
- **Deliverables**: `/contracts/job.schema.json` (AJV) + validator Lambda `lc-validate-job`.
- **Implementation**: Validate fields: `title`, `author`, `sourceRefs[]`, `edition`, `options` etc.
- **Acceptance Tests**:
  - Unit: invalid payloads rejected with 400 + field list.
  - Integration: execution fails at `ValidateJobRequest` on bad inputs; SFn error maps to `States.TaskFailed` with reason `SchemaValidationError`.
- **Rollback**: Relax schema patch.

### MS 1.3 — Init workdir
**Goal**: Create S3 prefix + manifest.
- **Deliverables**: Lambda `lc-init-workdir` writing `work/{bookId}/manifest.json`.
- **Implementation**: Generate `bookId` (slug+hash), tags, SSE‑KMS.
- **Acceptance Tests**: Object exists; has tags `bookId`, `jobId`.
- **Rollback**: None (idempotent).

---

## PHASE 2 — Acquire & Normalize Text

### MS 2.1 — Source fetch with allowlist
**Goal**: Download raw text/PDF from allowed domains.
- **Deliverables**: Lambda `lc-fetch-source` saving under `work/{bookId}/raw/`.
- **Implementation**: Allowlist: Gutenberg, Internet Archive, S3 internal. Fetch with HTTP Range+retries. Store SHA256.
- **Acceptance Tests**:
  - Unit: URL parser rejects non-allowlist.
  - Integration: Download fixture; `ContentType` correct; checksum logged.
- **Rollback**: Remove bad URL; re-run.

### MS 2.2 — OCR via Textract (conditional)
**Goal**: OCR scans.
- **Deliverables**: Choice state + Textract call; result in `ocr/blocks.json` + stitched text.
- **Implementation**: Detect binary or PDF lacking text layer; threshold via `pdfminer.six` check (in container Lambda).
- **Acceptance Tests**:
  - OCR confidence ≥ 0.93 average; page count matches PDF.
- **Rollback**: Mark page exceptions; manual review queue (SNS).

### MS 2.3 — Clean & normalize
**Goal**: Produce clean UTF‑8 text.
- **Deliverables**: Lambda `lc-clean` → `clean/clean.txt`.
- **Implementation**: Unicode NFKC; hyphenation removal (soft hyphens); strip headers/footers; fix em‑dashes.
- **Acceptance Tests**: Golden file tests; word count change within ±10% except scans.
- **Rollback**: Keep previous clean; diff report.

### MS 2.4 — Structure to Markdown + JSON ToC
**Goal**: Chapterized Markdown.
- **Deliverables**: `text/book.md`, `text/toc.json`.
- **Implementation**: Heuristics for “Chapter”/Roman numerals; footnotes → endnotes; front/back matter recognized.
- **Acceptance Tests**: Chapters within expected range; ToC anchors unique; no orphan headings.
- **Rollback**: Manual override rules per title (YAML).

---

## PHASE 3 — Metadata & Descriptions

### MS 3.1 — Metadata synth
**Goal**: Populate Books/Editions rows.
- **Deliverables**: Lambda `lc-generate-metadata` (country, BISAC, categories, keywords).
- **Implementation**: Deterministic slug; edition=Readers; version auto‑inc.
- **Acceptance Tests**: Idempotency: rerun yields same `bookId` and `editionId`.
- **Rollback**: Delete `Editions` row if wrong; re-run.

### MS 3.2 — ONIX 3.0 generation
**Goal**: Export machine‑readable metadata.
- **Deliverables**: `onix/onix.xml` (placeholder ISBNs).
- **Implementation**: Map fields; support multiple formats records.
- **Acceptance Tests**: Validate against ONIX schema; includes contributors, subject codes, descriptions.
- **Rollback**: Regenerate.

### MS 3.3 — Bedrock copy blocks
**Goal**: Marketing text.
- **Deliverables**: synopsis(≤10w), short desc, long desc, back‑cover, study questions.
- **Implementation**: Bedrock Claude family; temp ≤0.4; content filter. Store prompts+responses.
- **Acceptance Tests**: No policy flags; length constraints enforced.
- **Rollback**: Regenerate with seeded prompts.

---

## PHASE 4 — Covers & Illustrations

### MS 4.1 — Cover brief
**Goal**: Design spec JSON.
- **Deliverables**: `cover/brief.json` (palette, fonts, motifs).
- **Implementation**: Deterministic based on time period/genre.
- **Acceptance Tests**: JSON schema validity; preview PNG built.
- **Rollback**: Edit brief manually.

### MS 4.2 — Cover art (Bedrock Image)
**Goal**: Front artwork variants.
- **Deliverables**: `cover/art/{v1..v3}.png`.
- **Implementation**: Bedrock image model; 4K square; safe‑content prompts.
- **Acceptance Tests**: No NSFW flags; contrast ratio ok.
- **Rollback**: Rerun prompt with seed.

### MS 4.3 — Assemble cover PDFs
**Goal**: KDP/Ingram compliant full wraps.
- **Deliverables**: `cover/kdp_paperback.pdf`, `cover/ingram_hardback.pdf`.
- **Implementation**: Container Lambda with `ghostscript`/`libharu`; spine from page count; barcode box reserved.
- **Acceptance Tests**: Trim size correct; spine calc vs pages; PDF/X metadata present.
- **Rollback**: Recompose.

### MS 4.4 — Chapter vignettes / maps (optional)
**Goal**: Interior art.
- **Deliverables**: `interior/images/*.png` with alt text JSON.
- **Implementation**: Bedrock image; compress to 300dpi grayscale for print.
- **Acceptance Tests**: All images ≤ 2400px wide; alt text exists.
- **Rollback**: Skip images flag.

---

## PHASE 5 — Typesetting (Multi‑format)

### MS 5.1 — Build EPUB
**Goal**: Standards‑compliant EPUB 3.
- **Deliverables**: `epub/book.epub`.
- **Implementation**: Container Lambda running `pandoc` + templates; OPF from metadata; nav.xhtml; landmarks.
- **Acceptance Tests**:
  - `epubcheck` passes 0 errors.
  - Language tags & title page present.
- **Rollback**: Fix template; rerun.

### MS 5.2 — Kindle package
**Goal**: KDP‑ready EPUB.
- **Deliverables**: `kindle/book.epub` (same as EPUB).
- **Implementation**: Ensure media queries minimal; large images scaled.
- **Acceptance Tests**: Kindle Previewer passes; no fixed‑layout unless intentional.
- **Rollback**: Strip CSS causing issues.

### MS 5.3 — Print PDF (trade)
**Goal**: Print interior.
- **Deliverables**: `print/trade.pdf` (e.g., 6x9in).
- **Implementation**: Container Lambda using TeX (LuaLaTeX) or PrinceXML‑alt; widow/orphan control; ligatures.
- **Acceptance Tests**: Fonts embedded; margins correct; even page count; no RGB images in K‑only profile.
- **Rollback**: Adjust TeX settings.

### MS 5.4 — Large‑Print PDF
**Goal**: Accessible large print.
- **Deliverables**: `print/large_print.pdf`.
- **Implementation**: 16–18pt, 1.5 line spacing, extra margins, no hyphenation.
- **Acceptance Tests**: Visual check; automated font size audit; page numbers high contrast.
- **Rollback**: Increase size; rerun.

### MS 5.5 — Audiobook (Polly + mastering)
**Goal**: ACX‑compliant audio.
- **Deliverables**: `audio/*.mp3`, `audio/cuesheet.csv`.
- **Implementation**: SSML per chapter; Amazon Polly neural voice; `ffmpeg` mastering to ACX specs (RMS, peak, noise).
- **Acceptance Tests**: ACX check script passes; opening/closing credits present; retail sample generated.
- **Rollback**: Switch voice; tweak SSML breaks.

### MS 5.6 — Braille (Liblouis)
**Goal**: BRF/PEF output.
- **Deliverables**: `braille/book.brf`, `braille/book.pef`.
- **Implementation**: Liblouis container; 40‑cell width; UK UEB contractions.
- **Acceptance Tests**: Liblouis logs clean; pagination stable across runs.
- **Rollback**: Change contraction grade; rerun.

---

## PHASE 6 — Quality Gates

### MS 6.1 — Accessibility checks
**Goal**: Enforce a11y on EPUB/images.
- **Deliverables**: Report JSON `qg/a11y.json`.
- **Implementation**: Validate landmarks, alt text count, aria roles, page-list.
- **Acceptance Tests**: Report shows PASS; failures break execution.
- **Rollback**: Add missing landmarks; rerun.

### MS 6.2 — Metadata consistency
**Goal**: All formats agree on IDs & metadata.
- **Deliverables**: `qg/metadata.json`.
- **Implementation**: Compare ONIX ↔ OPF ↔ PDF XMP ↔ ID3 ↔ DynamoDB.
- **Acceptance Tests**: All fields match; mismatch causes fail.
- **Rollback**: Re‑stamp identifiers.

### MS 6.3 — Malware/virus scan
**Goal**: Clean artifacts.
- **Deliverables**: `qg/clamav.json`.
- **Implementation**: ClamAV container scans zips/pdfs/epubs/mp3.
- **Acceptance Tests**: No detections; quarantine path created for positives.
- **Rollback**: Replace assets.

---

## PHASE 7 — ISBNs, Stamping, Packaging

### MS 7.1 — ISBN allocation (stub → real)
**Goal**: Allocate ISBN per format.
- **Deliverables**: DynamoDB ISBN rows; `onix.xml` updated.
- **Implementation**: Stub generator in dev; pluggable provider for Nielsen/Bowker later.
- **Acceptance Tests**: Each format receives ISBN; uniqueness enforced.
- **Rollback**: Deallocate and retry.

### MS 7.2 — Identifier stamping
**Goal**: Write identifiers everywhere.
- **Deliverables**: Updated OPF, PDF XMP, ID3 tags, ONIX.
- **Implementation**: Mutate files in place; keep pre‑stamp copies.
- **Acceptance Tests**: Read back and compare; checksums change where expected.
- **Rollback**: Restore pre‑stamp backup.

### MS 7.3 — Final bundles
**Goal**: Channel zips ready for upload.
- **Deliverables**: `release/*` zips: EPUB, Print (int+cover), Audio set, Braille.
- **Implementation**: Lambda zips + manifest with SHA256.
- **Acceptance Tests**: Manifests list all assets with checksums; sizes reasonable.
- **Rollback**: Rebuild zips.

---

## PHASE 8 — Release, Index, Handover

### MS 8.1 — Promote to release bucket
**Goal**: Immutable artifacts.
- **Deliverables**: Copy from `work/` → `release/{bookId}/v{version}/…` with S3 Object Lock (governance) optional.
- **Implementation**: S3 copy; tag `immutable=true`.
- **Acceptance Tests**: Objects immutable; version IDs recorded in `Artifacts` table.
- **Rollback**: New version folder; never overwrite.

### MS 8.2 — Search indexing
**Goal**: Site search readiness.
- **Deliverables**: OpenSearch Serverless index doc.
- **Implementation**: Index title, author, categories, excerpt, tags.
- **Acceptance Tests**: Search returns the book in top 3 for its title/author.
- **Rollback**: Reindex.

### MS 8.3 — Notifications
**Goal**: Ops informed.
- **Deliverables**: SNS email/Slack with links to artifacts + ONIX.
- **Implementation**: SNS topic; subscriptions per environment.
- **Acceptance Tests**: Message received with correct URLs.
- **Rollback**: Re‑send.

### MS 8.4 — Manual publish gate
**Goal**: Human approval/upload.
- **Deliverables**: Step Functions task token; operator confirms after KDP/Ingram upload.
- **Implementation**: Small Lambda UI or Slack button to callback with token.
- **Acceptance Tests**: Execution waits; completes only after callback.
- **Rollback**: Timeout moves to `WAITING_FOR_PUBLISH` state for later resume.

### MS 8.5 — Archive workdir
**Goal**: Cost management & provenance.
- **Deliverables**: Lifecycle to Glacier Deep Archive; manifest retained.
- **Implementation**: S3 lifecycle rules; Glacier restore policy.
- **Acceptance Tests**: Objects show transition date; retrieval tested for a sample.
- **Rollback**: Temporarily suspend transition.

### MS 8.6 — Metrics & SLA
**Goal**: Measure throughput & quality.
- **Deliverables**: CloudWatch dashboard: step timings, fail rates, average ACX margin, epubcheck error rate.
- **Implementation**: PutMetricData from each step; alarms on spikes.
- **Acceptance Tests**: Dashboard displays metrics; test alarm fires on induced fail.
- **Rollback**: Disable alarm; tune thresholds.

---

## CROSS‑CUTTING — Security, IAM, Cost, DevX

### MS S.1 — IAM least privilege
**Goal**: Tight roles.
- **Deliverables**: One role per Lambda; S3 prefix policies; KMS grant only to needed ARNs.
- **Acceptance Tests**: Access denied when touching other prefixes; KMS Decrypt limited.
- **Rollback**: Temporarily widen with TODO.

### MS S.2 — Cost controls
**Goal**: Prevent runaway costs.
- **Deliverables**: Service Quotas set; Bedrock LLM tokens capped; Curfew via EventBridge Scheduler.
- **Acceptance Tests**: Exceeding quota triggers graceful backoff & alert.
- **Rollback**: Increase quota after approval.

### MS S.3 — DevX scripts
**Goal**: One‑liners for local dev.
- **Deliverables**: `./scripts/dev-start.sh`, `./scripts/run-book.sh --title Dracula --source <url>`.
- **Acceptance Tests**: Script launches execution; shows live progress URL.
- **Rollback**: Fix scripts.

---

## SAMPLE TEST FIXTURES

- **Canonical title**: *Dracula* (Gutenberg text) — covers headings, letters, chapter variations.
- **Scan fixture**: 10‑page scanned PDF (for Textract path).
- **Short text**: Public‑domain poem to run a 60‑second “smoke” pipeline.

---

## CONTRACTS (JSON Schemas excerpts)

**Job Input (`job.schema.json`)**  
```json
{
  "type": "object",
  "required": ["title", "author", "sourceRefs", "edition"],
  "properties": {
    "title": { "type": "string", "minLength": 2 },
    "author": { "type": "string" },
    "edition": { "type": "string", "enum": ["Readers"] },
    "locales": { "type": "array", "items": { "type": "string" }, "default": ["en-GB"] },
    "sourceRefs": {
      "type": "array",
      "items": { "type": "string", "pattern": "^(https?|s3)://" },
      "minItems": 1
    },
    "options": {
      "type": "object",
      "properties": {
        "illustrations": { "type": "boolean", "default": true },
        "largePrint": { "type": "boolean", "default": true },
        "audiobook": { "type": "boolean", "default": false },
        "braille": { "type": "boolean", "default": false }
      }
    }
  }
}
```

**Artifact Manifest (`manifest.schema.json`)**  
```json
{
  "type":"object",
  "required":["bookId","editionId","version","artifacts"],
  "properties":{
    "bookId":{"type":"string"},
    "editionId":{"type":"string"},
    "version":{"type":"integer","minimum":1},
    "artifacts":{
      "type":"array",
      "items":{
        "type":"object",
        "required":["kind","format","s3Key","sha256"],
        "properties":{
          "kind":{"enum":["EPUB","KINDLE","PRINT","LARGE_PRINT","AUDIO","BRAILLE","COVER","ONIX","REPORT"]},
          "format":{"type":"string"},
          "s3Key":{"type":"string"},
          "sha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}
        }
      }
    }
  }
}
```

---

## PROMOTION FLOW

- **Dev**: run on *Dracula* fixture until all steps PASS.
- **Stage**: run on 3 titles (short, long, scanned). Collect metrics; tweak.
- **Prod**: enable features (audiobook/braille) via `options` per title. Track cost & time per build.

---

## DONE CRITERIA FOR “COMPLETE SYSTEM” (Reader’s Edition)

1. Start execution with valid job JSON.
2. Artifacts produced: **EPUB, Kindle‑EPUB, Print PDF, Large‑Print PDF, ONIX, Covers**.
3. Optional: **Audiobook MP3 set, Braille BRF/PEF** when `options` enabled.
4. All quality gates PASS (EPUBCheck 0 errors; ACX checks green if audio).
5. Immutable artifacts promoted to `release/` with manifest + checksums.
6. DynamoDB reflects book/edition/artifacts; OpenSearch index searchable.
7. Ops notified; human Publish Gate waits and completes on callback.
8. Re‑running with same job is idempotent (new `version` if content changed).

---

### Notes
- For **PrinceXML** you’ll likely use a licensed container runner; otherwise prefer **LuaLaTeX** for FOSS.
- Keep **feature flags** in input to avoid blocking the pipeline while you iterate formats.
- Consider **Step Functions Map** state to fan‑out chapters for Polly synthesis in parallel.

