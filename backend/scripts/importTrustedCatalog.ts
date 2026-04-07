import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Book, WorkType } from "../../contracts/domain";
import { createCatalogBook, listCatalogBooks } from "../shared/catalogService";
import { getCatalogTitleAuthorKey } from "../shared/catalogIdentity";
import { CatalogBookExistsError } from "../shared/catalogTypes";
import { loadBackendEnv } from "../shared/loadLocalEnv";

loadBackendEnv();

const validWorkTypes: WorkType[] = [
  "Novel",
  "Play",
  "Poem",
  "Essay",
  "Collection",
  "Short Story",
  "Other",
];

interface ParsedArgs {
  inputPath: string;
  dryRun: boolean;
  limit: number | null;
  defaultSource: string | null;
  defaultPublicDomainNotes: string | null;
}

interface ImportOutcome {
  title: string;
  author: string;
  id?: string;
}

interface FailureOutcome {
  index: number;
  reason: string;
  title?: string;
  author?: string;
}

type JsonRecord = Record<string, unknown>;

function parseArgs(argv: string[]): ParsedArgs {
  let inputPath = "";
  let dryRun = false;
  let limit: number | null = null;
  let defaultSource: string | null = null;
  let defaultPublicDomainNotes: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--input":
        inputPath = next ?? "";
        index += 1;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--limit":
        limit = next ? Number.parseInt(next, 10) : Number.NaN;
        index += 1;
        break;
      case "--default-source":
        defaultSource = next?.trim() || null;
        index += 1;
        break;
      case "--default-public-domain-notes":
        defaultPublicDomainNotes = next?.trim() || null;
        index += 1;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!inputPath) {
    throw new Error("Provide --input with a JSON or NDJSON file path.");
  }

  if (limit !== null && (!Number.isFinite(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }

  return {
    inputPath,
    dryRun,
    limit,
    defaultSource,
    defaultPublicDomainNotes,
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function getStringField(
  record: JsonRecord,
  ...fieldNames: string[]
): string | null {
  for (const fieldName of fieldNames) {
    const value = normalizeString(record[fieldName]);

    if (value) {
      return value;
    }
  }

  return null;
}

function parseYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^-?\d{1,6}$/);

    if (!match) {
      return null;
    }

    const parsed = Number.parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "yes", "y", "1"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "n", "0"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    )];
  }

  if (typeof value === "string") {
    return [...new Set(
      value
        .split(/[;,|]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    )];
  }

  return [];
}

function parseWorkType(value: unknown): WorkType | undefined {
  if (typeof value === "string" && validWorkTypes.includes(value as WorkType)) {
    return value as WorkType;
  }

  return undefined;
}

function extractAuthor(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeString(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractAuthor(entry);

      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (isRecord(value)) {
    return getStringField(value, "name", "author", "creator");
  }

  return null;
}

function buildCandidate(
  raw: unknown,
  defaults: Pick<ParsedArgs, "defaultSource" | "defaultPublicDomainNotes">,
): { candidate?: Partial<Book>; reason?: string } {
  if (!isRecord(raw)) {
    return { reason: "Record is not a JSON object." };
  }

  const title = getStringField(raw, "title", "bookTitle", "name");
  const author =
    getStringField(raw, "author", "creator") ??
    extractAuthor(raw.authors) ??
    extractAuthor(raw.creators);

  if (!title || !author) {
    return { reason: "Record is missing a title or author." };
  }

  const explicitPublicDomain =
    parseBoolean(raw.publicDomain) ??
    parseBoolean(raw.isPublicDomain) ??
    null;

  if (explicitPublicDomain === false) {
    return { reason: "Record is explicitly marked as not public domain." };
  }

  const year =
    parseYear(raw.year) ??
    parseYear(raw.publicationYear) ??
    parseYear(raw.releaseYear) ??
    parseYear(raw.issued);

  const source =
    getStringField(raw, "source", "url", "ebookUrl", "catalogUrl") ??
    defaults.defaultSource;

  const publicDomainNotes =
    getStringField(raw, "publicDomainNotes", "rights", "copyrightStatus") ??
    defaults.defaultPublicDomainNotes;

  const workType = parseWorkType(raw.workType ?? raw.type ?? raw.workTypeLabel);
  const summary = getStringField(raw, "summary", "description", "excerpt") ?? "";
  const authorBio = getStringField(raw, "authorBio", "creatorBio", "bio") ?? "";
  const category = getStringField(raw, "category", "genre");
  const tags = parseTags(raw.tags ?? raw.subjects ?? raw.keywords);

  const candidate: Partial<Book> = {
    title,
    author,
    summary,
    authorBio,
    tags,
    publicDomain: explicitPublicDomain ?? true,
    ...(year !== null ? { year } : {}),
    ...(getStringField(raw, "era") ? { era: getStringField(raw, "era") } : {}),
    ...(getStringField(raw, "country", "originCountry")
      ? { country: getStringField(raw, "country", "originCountry") }
      : {}),
    ...(category ? { category } : {}),
    ...(workType ? { workType } : {}),
    ...(source ? { source } : {}),
    ...(publicDomainNotes ? { publicDomainNotes } : {}),
  };

  return { candidate };
}

async function loadInputRecords(filePath: string): Promise<unknown[]> {
  const contents = await readFile(filePath, "utf8");
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".ndjson" || extension === ".jsonl") {
    return contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown);
  }

  const parsed = JSON.parse(contents) as unknown;

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (isRecord(parsed) && Array.isArray(parsed.books)) {
    return parsed.books;
  }

  throw new Error(
    "Input must be a JSON array, an object with a books array, or NDJSON.",
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const resolvedInputPath = path.resolve(process.cwd(), args.inputPath);
  const rawRecords = await loadInputRecords(resolvedInputPath);
  const limitedRecords =
    args.limit === null ? rawRecords : rawRecords.slice(0, args.limit);
  const existingKeys = new Set(
    (await listCatalogBooks()).map((book) => getCatalogTitleAuthorKey(book)),
  );
  const seenInputKeys = new Set<string>();
  const imported: ImportOutcome[] = [];
  const failures: FailureOutcome[] = [];

  let skippedExisting = 0;
  let skippedInputDuplicates = 0;
  let skippedInvalid = 0;

  for (const [index, rawRecord] of limitedRecords.entries()) {
    const mapped = buildCandidate(rawRecord, args);

    if (!mapped.candidate?.title || !mapped.candidate.author) {
      skippedInvalid += 1;
      failures.push({
        index,
        reason: mapped.reason ?? "Record could not be normalized.",
      });
      continue;
    }

    const catalogKey = getCatalogTitleAuthorKey({
      title: mapped.candidate.title,
      author: mapped.candidate.author,
    });

    if (seenInputKeys.has(catalogKey)) {
      skippedInputDuplicates += 1;
      continue;
    }

    seenInputKeys.add(catalogKey);

    if (existingKeys.has(catalogKey)) {
      skippedExisting += 1;
      continue;
    }

    if (args.dryRun) {
      existingKeys.add(catalogKey);
      imported.push({
        title: mapped.candidate.title,
        author: mapped.candidate.author,
      });
      continue;
    }

    try {
      const created = await createCatalogBook(mapped.candidate);
      existingKeys.add(catalogKey);
      imported.push({
        title: created.title,
        author: created.author,
        id: created.id,
      });
    } catch (error) {
      if (error instanceof CatalogBookExistsError) {
        skippedExisting += 1;
        continue;
      }

      skippedInvalid += 1;
      failures.push({
        index,
        reason: error instanceof Error ? error.message : "Unknown import failure.",
        title: mapped.candidate.title,
        author: mapped.candidate.author,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        inputPath: args.inputPath,
        resolvedInputPath,
        dryRun: args.dryRun,
        limit: args.limit,
        totalInputRecords: rawRecords.length,
        processedRecords: limitedRecords.length,
        importedCount: imported.length,
        skippedExisting,
        skippedInputDuplicates,
        skippedInvalid,
        defaultSource: args.defaultSource,
        defaultPublicDomainNotes: args.defaultPublicDomainNotes,
        imported: imported.slice(0, 25),
        failures: failures.slice(0, 25),
        note:
          "The importer keeps cost low by using local metadata files, deduping before writes, skipping explicit non-public-domain records, and storing compact catalog metadata only.",
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error("Trusted catalog import failed:", error);
  process.exitCode = 1;
});
