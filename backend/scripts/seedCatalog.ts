import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { seedCatalogBooks, seedFaqEntries } from "../../contracts/catalog-seed";
import type { Book } from "../../contracts/domain";
import {
  BOOKS_PARTITION_KEY,
  FAQ_PARTITION_KEY,
  buildCatalogBookSortKey,
  buildCatalogFaqSortKey,
  normalizeCatalogText,
} from "../shared/catalogIdentity";
import { getDynamoDocumentClient } from "../shared/dynamo";
import { getRequiredEnv } from "../shared/env";
import { loadBackendEnv } from "../shared/loadLocalEnv";

loadBackendEnv();

function isConditionalCheckFailed(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ConditionalCheckFailedException";
}

function enrichSeedBook(book: Book): Book {
  return {
    ...book,
    titleNormalized: normalizeCatalogText(book.title),
    authorNormalized: normalizeCatalogText(book.author),
    searchIndex: [
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
      .toLowerCase(),
  };
}

async function main(): Promise<void> {
  const tableName = getRequiredEnv("BOOKS_TABLE_NAME");
  const client = getDynamoDocumentClient();

  let createdBooks = 0;
  let skippedBooks = 0;

  for (const seedBook of seedCatalogBooks) {
    const book = enrichSeedBook(seedBook);

    try {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            pk: BOOKS_PARTITION_KEY,
            sk: buildCatalogBookSortKey(book),
            entityType: "book",
            ...book,
          },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        }),
      );
      createdBooks += 1;
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        skippedBooks += 1;
        continue;
      }

      throw error;
    }
  }

  for (const faqEntry of seedFaqEntries) {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: FAQ_PARTITION_KEY,
          sk: buildCatalogFaqSortKey(faqEntry),
          entityType: "faq",
          ...faqEntry,
        },
      }),
    );
  }

  console.log(
    JSON.stringify(
      {
        tableName,
        createdBooks,
        skippedBooks,
        faqEntriesUpserted: seedFaqEntries.length,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error("Catalog seed failed:", error);
  process.exitCode = 1;
});
