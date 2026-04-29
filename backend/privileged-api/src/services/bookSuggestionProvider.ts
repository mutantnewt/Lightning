import type { Book, WorkType } from "../../../../contracts/domain";
import {
  offlineBookSuggestionCatalog,
  type OfflineBookSuggestionEntry,
} from "../../../../contracts/book-suggestions-seed";
import type {
  BookSearchResult,
  ExistingBookReference,
} from "../../../../contracts/book-suggestions";
import { getEnv } from "../../../shared/env";

interface SearchProviderInput {
  title?: string;
  author?: string;
  keyword?: string;
  existingBooks?: ExistingBookReference[];
}

interface SearchProviderOutput {
  source: "openai" | "offline";
  results: BookSearchResult[];
}

interface DetailsProviderOutput {
  source: "openai" | "offline";
  book: Partial<Book>;
}

interface GutendexPerson {
  name?: string | null;
  birth_year?: number | null;
  death_year?: number | null;
}

interface GutendexBook {
  id?: number | null;
  title?: string | null;
  authors?: GutendexPerson[];
  summaries?: string[];
  subjects?: string[];
  bookshelves?: string[];
  copyright?: boolean | null;
  formats?: Record<string, string>;
}

interface GutendexResponse {
  results?: GutendexBook[];
}

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

function stripCodeFences(value: string): string {
  return value.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function describeFallbackError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function logOfflineFallback(context: string, error: unknown): void {
  console.info(`${context}: ${describeFallbackError(error)}`);
}

function toTitleCaseAuthorName(value: string | null | undefined): string {
  const raw = (value ?? "").trim();

  if (!raw.includes(",")) {
    return raw;
  }

  const [surname, ...rest] = raw.split(",").map((part) => part.trim()).filter(Boolean);

  if (!surname || rest.length === 0) {
    return raw;
  }

  return `${rest.join(" ")} ${surname}`.replace(/\s+/g, " ").trim();
}

function getPrimaryGutendexAuthor(book: GutendexBook): string {
  return toTitleCaseAuthorName(book.authors?.[0]?.name);
}

function getGutendexAuthorYears(book: GutendexBook): string | null {
  const author = book.authors?.[0];

  if (!author) {
    return null;
  }

  const birthYear = typeof author.birth_year === "number" ? author.birth_year : null;
  const deathYear = typeof author.death_year === "number" ? author.death_year : null;

  if (birthYear === null && deathYear === null) {
    return null;
  }

  return `${birthYear ?? "?"}-${deathYear ?? "?"}`;
}

function toExistingBookKey(book: ExistingBookReference): string {
  return `${normalizeText(book.title)}::${normalizeText(book.author)}`;
}

function toOfflineSearchHaystack(entry: OfflineBookSuggestionEntry): string {
  return [
    entry.search.title,
    entry.search.author,
    entry.search.brief,
    entry.details.summary,
    entry.details.authorBio,
    entry.details.category,
    entry.details.era,
    entry.details.country,
    ...(entry.details.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterOfflineCatalog(input: SearchProviderInput): OfflineBookSuggestionEntry[] {
  const titleQuery = normalizeText(input.title);
  const authorQuery = normalizeText(input.author);
  const keywordQuery = normalizeText(input.keyword);
  const existingBookKeys = new Set((input.existingBooks ?? []).map(toExistingBookKey));

  return offlineBookSuggestionCatalog.filter((entry) => {
    const bookKey = `${normalizeText(entry.search.title)}::${normalizeText(entry.search.author)}`;

    if (existingBookKeys.has(bookKey)) {
      return false;
    }

    if (titleQuery && !normalizeText(entry.search.title).includes(titleQuery)) {
      return false;
    }

    if (authorQuery && !normalizeText(entry.search.author).includes(authorQuery)) {
      return false;
    }

    if (keywordQuery && !toOfflineSearchHaystack(entry).includes(keywordQuery)) {
      return false;
    }

    return true;
  });
}

function fallbackSearch(input: SearchProviderInput): SearchProviderOutput {
  return {
    source: "offline",
    results: filterOfflineCatalog(input).slice(0, 10).map((entry) => entry.search),
  };
}

function fallbackDetails(title: string, author: string): DetailsProviderOutput {
  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = normalizeText(author);
  const match = offlineBookSuggestionCatalog.find(
    (entry) =>
      normalizeText(entry.search.title) === normalizedTitle &&
      normalizeText(entry.search.author) === normalizedAuthor,
  );

  if (!match) {
    throw new Error("No offline suggestion details found for that book.");
  }

  return {
    source: "offline",
    book: match.details,
  };
}

function buildGutendexSearchQuery(input: SearchProviderInput): string {
  return [input.title, input.author, input.keyword]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

async function fetchGutendexResults(input: SearchProviderInput): Promise<GutendexBook[]> {
  const query = buildGutendexSearchQuery(input);

  if (!query) {
    return [];
  }

  const baseUrl = getEnv("GUTENDEX_API_BASE_URL") ?? "https://gutendex.com";
  const url = new URL("/books/", baseUrl);
  url.searchParams.set("search", query);
  url.searchParams.set("languages", "en");
  url.searchParams.set("copyright", "false");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "LightningClassicsAddBook/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Gutendex request failed: ${response.status}`);
    }

    const payload = (await response.json()) as GutendexResponse;
    return Array.isArray(payload.results) ? payload.results : [];
  } finally {
    clearTimeout(timeout);
  }
}

function getGutendexSource(book: GutendexBook): string | null {
  if (typeof book.id === "number") {
    return `https://www.gutenberg.org/ebooks/${book.id}`;
  }

  return book.formats?.["text/html"] ?? null;
}

function cleanGutendexSummary(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s*\(This is an automatically generated summary\.\)\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function getGutendexTags(book: GutendexBook): string[] {
  return [
    ...(book.subjects ?? []),
    ...(book.bookshelves ?? []),
  ]
    .map((tag) => tag.replace(/^Category:\s*/iu, "").split("--")[0]?.trim() ?? "")
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index)
    .slice(0, 6);
}

function inferGutendexWorkType(book: GutendexBook): WorkType {
  const tagsText = [...(book.subjects ?? []), ...(book.bookshelves ?? [])]
    .join(" ")
    .toLowerCase();

  if (tagsText.includes("drama") || tagsText.includes("plays")) {
    return "Play";
  }

  if (tagsText.includes("poetry") || tagsText.includes("poems")) {
    return "Poem";
  }

  if (tagsText.includes("essays")) {
    return "Essay";
  }

  if (tagsText.includes("short stories")) {
    return "Short Story";
  }

  if (tagsText.includes("fiction") || tagsText.includes("novel")) {
    return "Novel";
  }

  return "Other";
}

function inferGutendexEra(book: GutendexBook): string | null {
  const birthYear = book.authors?.[0]?.birth_year;
  const deathYear = book.authors?.[0]?.death_year;

  if (
    (typeof birthYear === "number" && birthYear < 500) ||
    (typeof deathYear === "number" && deathYear < 500)
  ) {
    return "Classical";
  }

  return null;
}

function mapGutendexSearchResult(book: GutendexBook): BookSearchResult | null {
  const title = (book.title ?? "").trim();
  const author = getPrimaryGutendexAuthor(book);

  if (!title || !author || book.copyright !== false) {
    return null;
  }

  const summary = cleanGutendexSummary(book.summaries?.[0]);
  const tags = getGutendexTags(book);

  return {
    title,
    author,
    year: null,
    brief: truncateText(
      summary || tags.slice(0, 3).join(", ") || "Public domain work listed by Project Gutenberg.",
      180,
    ),
  };
}

function mapGutendexDetails(book: GutendexBook): Partial<Book> | null {
  const title = (book.title ?? "").trim();
  const author = getPrimaryGutendexAuthor(book);

  if (!title || !author || book.copyright !== false) {
    return null;
  }

  const authorYears = getGutendexAuthorYears(book);
  const tags = getGutendexTags(book);
  const summary = cleanGutendexSummary(book.summaries?.[0]);

  return {
    title,
    author,
    year: null,
    era: inferGutendexEra(book),
    country: null,
    category: tags[0] ?? "Public Domain",
    workType: inferGutendexWorkType(book),
    summary: summary || "Project Gutenberg lists this public domain work, but no generated summary is available in the metadata export.",
    authorBio: authorYears
      ? `${author} (${authorYears}) is listed as the primary author in Project Gutenberg metadata.`
      : `${author} is listed as the primary author in Project Gutenberg metadata.`,
    tags,
    publicDomain: true,
    publicDomainNotes:
      "Project Gutenberg metadata lists this work as public domain. Confirm source details during moderation before publication.",
    source: getGutendexSource(book),
  };
}

async function gutendexSearch(input: SearchProviderInput): Promise<SearchProviderOutput> {
  const existingBookKeys = new Set((input.existingBooks ?? []).map(toExistingBookKey));
  const results = (await fetchGutendexResults(input))
    .map(mapGutendexSearchResult)
    .filter((result): result is BookSearchResult => result !== null)
    .filter((result) => !existingBookKeys.has(toExistingBookKey(result)))
    .slice(0, 10);

  return {
    source: "offline",
    results,
  };
}

function findBestGutendexDetailsMatch(
  books: GutendexBook[],
  title: string,
  author: string,
): GutendexBook | null {
  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = normalizeText(author);
  const mappedBooks = books.filter(
    (book) => mapGutendexSearchResult(book) !== null,
  );

  return (
    mappedBooks.find(
      (book) =>
        normalizeText(book.title).includes(normalizedTitle) &&
        normalizeText(getPrimaryGutendexAuthor(book)).includes(normalizedAuthor),
    ) ??
    mappedBooks.find((book) => normalizeText(book.title).includes(normalizedTitle)) ??
    mappedBooks[0] ??
    null
  );
}

async function gutendexDetails(
  title: string,
  author: string,
): Promise<DetailsProviderOutput> {
  const match = findBestGutendexDetailsMatch(
    await fetchGutendexResults({ title, author }),
    title,
    author,
  );
  const book = match ? mapGutendexDetails(match) : null;

  if (!book) {
    throw new Error("No Project Gutenberg suggestion details found for that book.");
  }

  return {
    source: "offline",
    book,
  };
}

async function callOpenAiJson(prompt: string): Promise<unknown> {
  const apiKey = getEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty completion.");
  }

  return JSON.parse(stripCodeFences(content));
}

function validateSearchResults(value: unknown): BookSearchResult[] {
  if (!Array.isArray(value)) {
    throw new Error("Search results must be an array.");
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      title: typeof item.title === "string" ? item.title.trim() : "",
      author: typeof item.author === "string" ? item.author.trim() : "",
      year: typeof item.year === "number" ? item.year : null,
      brief: typeof item.brief === "string" ? item.brief.trim() : "",
    }))
    .filter((item) => item.title && item.author && item.brief);
}

function validateBookDetails(value: unknown): Partial<Book> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Book details must be an object.");
  }

  const item = value as Record<string, unknown>;
  const workType =
    typeof item.workType === "string" && validWorkTypes.includes(item.workType as WorkType)
      ? (item.workType as WorkType)
      : "Other";

  return {
    title: typeof item.title === "string" ? item.title.trim() : "",
    author: typeof item.author === "string" ? item.author.trim() : "",
    year: typeof item.year === "number" ? item.year : null,
    era: typeof item.era === "string" ? item.era.trim() : null,
    country: typeof item.country === "string" ? item.country.trim() : null,
    category: typeof item.category === "string" ? item.category.trim() : null,
    workType,
    summary: typeof item.summary === "string" ? item.summary.trim() : "",
    authorBio: typeof item.authorBio === "string" ? item.authorBio.trim() : "",
    tags: Array.isArray(item.tags)
      ? item.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    publicDomain: Boolean(item.publicDomain),
    publicDomainNotes:
      typeof item.publicDomainNotes === "string" ? item.publicDomainNotes.trim() : null,
    source: typeof item.source === "string" ? item.source.trim() : null,
  };
}

export async function searchBookSuggestions(
  input: SearchProviderInput,
): Promise<SearchProviderOutput> {
  const hasAnyInput = Boolean(input.title || input.author || input.keyword);

  if (!hasAnyInput) {
    throw new Error("At least title, author, or keyword must be provided.");
  }

  const existingBooksText = (input.existingBooks ?? [])
    .map((book) => `"${book.title}" by ${book.author}`)
    .join(", ");

  const prompt = `You are a literary expert specializing in public domain classic literature.

Search criteria:
${input.title ? `Title: ${input.title}` : ""}
${input.author ? `Author: ${input.author}` : ""}
${input.keyword ? `Subject/Keyword: ${input.keyword}` : ""}

Find 5-10 public domain classic literature books that match the search criteria above. Only include books that are definitively in the public domain in the United States.

${existingBooksText ? `IMPORTANT: Do NOT include any of these books that are already in our database: ${existingBooksText}` : ""}

Return the results as a JSON array with this exact structure:
[
  {
    "title": "exact book title",
    "author": "author full name",
    "year": 1861,
    "brief": "one-line description"
  }
]

Only return the JSON array.`;

  try {
    const response = await callOpenAiJson(prompt);
    return {
      source: "openai",
      results: validateSearchResults(response),
    };
  } catch (error) {
    logOfflineFallback("Using non-AI Add Book search suggestions", error);
  }

  try {
    return await gutendexSearch(input);
  } catch (error) {
    logOfflineFallback("Using offline Add Book search suggestions", error);
    return fallbackSearch(input);
  }
}

export async function getBookSuggestionDetails(
  title: string,
  author: string,
): Promise<DetailsProviderOutput> {
  if (!title.trim() || !author.trim()) {
    throw new Error("Title and author are required.");
  }

  const prompt = `You are a literary expert. Provide comprehensive details about the following public domain book:

Title: "${title}"
Author: ${author}

Return a JSON object with this exact structure:
{
  "title": "exact book title",
  "author": "author full name",
  "year": 1861,
  "era": "Victorian",
  "country": "England",
  "category": "Historical Fiction",
  "workType": "Novel",
  "summary": "120-150 word summary",
  "authorBio": "40-60 word biography",
  "tags": ["array", "of", "tags"],
  "publicDomain": true,
  "publicDomainNotes": "brief explanation of public domain status",
  "source": "https://www.gutenberg.org/..."
}

Only return the JSON object.`;

  try {
    const response = await callOpenAiJson(prompt);
    return {
      source: "openai",
      book: validateBookDetails(response),
    };
  } catch (error) {
    logOfflineFallback("Using non-AI Add Book detail suggestions", error);
  }

  try {
    return await gutendexDetails(title, author);
  } catch (error) {
    logOfflineFallback("Using offline Add Book detail suggestions", error);
    return fallbackDetails(title, author);
  }
}
