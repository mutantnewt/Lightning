import OpenAI from "openai";
import { Book, WorkType } from "@/types";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Note: In production, API calls should go through a backend
});

export interface BookSearchResult {
  title: string;
  author: string;
  year: number;
  brief: string; // Brief one-line description
}

export async function searchBooks(
  title?: string,
  author?: string,
  existingBooks?: Book[]
): Promise<BookSearchResult[]> {
  if (!title && !author) {
    throw new Error("At least title or author must be provided");
  }

  const existingBooksStr = existingBooks
    ? existingBooks.map((b) => `"${b.title}" by ${b.author}`).join(", ")
    : "";

  const prompt = `You are a literary expert specializing in public domain classic literature.

Search criteria:
${title ? `Title: ${title}` : ""}
${author ? `Author: ${author}` : ""}

Find 5-10 public domain classic literature books that match the search criteria above. Only include books that are definitively in the public domain in the United States (typically published before 1929, or works by authors who died over 95 years ago).

${existingBooksStr ? `IMPORTANT: Do NOT include any of these books that are already in our database: ${existingBooksStr}` : ""}

Return the results as a JSON array with this exact structure:
[
  {
    "title": "exact book title",
    "author": "author full name",
    "year": publication_year_as_number,
    "brief": "one-line description (max 100 characters)"
  }
]

Only return the JSON array, no other text or markdown formatting.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content?.trim() || "[]";

    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const results = JSON.parse(jsonStr) as BookSearchResult[];
    return results;
  } catch (error) {
    console.error("Error searching books:", error);
    throw new Error("Failed to search for books. Please try again.");
  }
}

export async function getBookDetails(
  title: string,
  author: string
): Promise<Partial<Book>> {
  const prompt = `You are a literary expert. Provide comprehensive details about the following public domain book:

Title: "${title}"
Author: ${author}

Return a JSON object with this exact structure:
{
  "title": "exact book title",
  "author": "author full name",
  "year": publication_year_as_number,
  "era": "literary era (e.g., Victorian, Renaissance, Romantic, etc.)",
  "country": "country of origin",
  "category": "primary genre/category",
  "workType": "one of: Novel, Play, Poem, Essay, Collection, Short Story, or Other",
  "summary": "120-150 word summary of the work, its themes, and literary significance",
  "authorBio": "40-60 word biography of the author including birth-death dates and major works",
  "tags": ["array", "of", "3-5", "relevant", "tags"],
  "publicDomain": boolean (true if definitely public domain in US),
  "publicDomainNotes": "brief explanation of public domain status",
  "source": "https://www.gutenberg.org/ or similar public domain source URL"
}

Only return the JSON object, no other text or markdown formatting.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content?.trim() || "{}";

    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const details = JSON.parse(jsonStr) as Partial<Book>;

    // Validate workType
    const validWorkTypes: WorkType[] = ["Novel", "Play", "Poem", "Essay", "Collection", "Short Story", "Other"];
    if (details.workType && !validWorkTypes.includes(details.workType as WorkType)) {
      details.workType = "Other";
    }

    return details;
  } catch (error) {
    console.error("Error getting book details:", error);
    throw new Error("Failed to get book details. Please try again.");
  }
}
