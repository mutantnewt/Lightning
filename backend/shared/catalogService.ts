import type { Book, FaqEntry, WorkType } from "../../contracts/domain";
import { getCatalogStore } from "./catalogStore";

const validWorkTypes: WorkType[] = [
  "Novel",
  "Play",
  "Poem",
  "Essay",
  "Collection",
  "Short Story",
  "Other",
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeYear(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeWorkType(value: unknown): WorkType {
  if (typeof value === "string" && validWorkTypes.includes(value as WorkType)) {
    return value as WorkType;
  }

  return "Other";
}

function buildCatalogBookId(title: string, author: string): string {
  return `book:${slugify(author)}:${slugify(title)}`;
}

function buildSearchIndex(book: Omit<Book, "searchIndex">): string {
  return [
    book.title,
    book.author,
    book.year ? String(book.year) : null,
    book.era,
    book.country,
    book.category,
    book.workType,
    book.summary,
    book.authorBio,
    ...(book.tags ?? []),
    book.source,
    book.publicDomainNotes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function toCatalogBook(input: Partial<Book>): Book {
  const title = normalizeOptionalString(input.title);
  const author = normalizeOptionalString(input.author);

  if (!title || !author) {
    throw new Error("Catalog books require a title and author.");
  }

  const createdAt = new Date().toISOString();
  const book: Omit<Book, "searchIndex"> = {
    id: buildCatalogBookId(title, author),
    title,
    author,
    year: normalizeYear(input.year),
    era: normalizeOptionalString(input.era),
    country: normalizeOptionalString(input.country),
    category: normalizeOptionalString(input.category),
    workType: normalizeWorkType(input.workType),
    summary: normalizeOptionalString(input.summary) ?? "",
    authorBio: normalizeOptionalString(input.authorBio) ?? "",
    tags: normalizeTags(input.tags),
    source: normalizeOptionalString(input.source),
    publicDomain: input.publicDomain ?? true,
    publicDomainNotes: normalizeOptionalString(input.publicDomainNotes),
    createdAt,
    updatedAt: createdAt,
    titleNormalized: normalizeText(title),
    authorNormalized: normalizeText(author),
  };

  return {
    ...book,
    searchIndex: buildSearchIndex(book),
  };
}

export async function listCatalogBooks(): Promise<Book[]> {
  return getCatalogStore().listBooks();
}

export async function listFaqEntries(): Promise<FaqEntry[]> {
  return getCatalogStore().listFaqEntries();
}

export async function listAuthorBooks(authorName: string): Promise<Book[]> {
  return getCatalogStore().listBooksByAuthor(authorName);
}

export async function createCatalogBook(input: Partial<Book>): Promise<Book> {
  const book = toCatalogBook(input);
  return getCatalogStore().createBook(book);
}
