import {
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Book, FaqEntry } from "../../contracts/domain";
import {
  BOOKS_PARTITION_KEY,
  FAQ_PARTITION_KEY,
  buildCatalogBookSortKey,
  buildCatalogFaqSortKey,
  normalizeCatalogText,
} from "./catalogIdentity";
import { getDynamoDocumentClient } from "./dynamo";
import { getRequiredEnv } from "./env";
import {
  CatalogBookExistsError,
  type CatalogStore,
} from "./catalogTypes";

interface CatalogBookItem extends Book {
  pk: string;
  sk: string;
  entityType: "book";
}

interface CatalogFaqItem extends FaqEntry {
  pk: string;
  sk: string;
  entityType: "faq";
}

function toBook(item: CatalogBookItem): Book {
  return {
    id: item.id,
    title: item.title,
    author: item.author,
    year: item.year ?? null,
    era: item.era ?? null,
    country: item.country ?? null,
    category: item.category ?? null,
    workType: item.workType,
    summary: item.summary,
    authorBio: item.authorBio,
    tags: item.tags ?? [],
    source: item.source ?? null,
    publicDomain: item.publicDomain,
    publicDomainNotes: item.publicDomainNotes ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(item.searchIndex ? { searchIndex: item.searchIndex } : {}),
    ...(item.titleNormalized ? { titleNormalized: item.titleNormalized } : {}),
    ...(item.authorNormalized ? { authorNormalized: item.authorNormalized } : {}),
  };
}

function toFaqEntry(item: CatalogFaqItem): FaqEntry {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    order: item.order,
    isActive: item.isActive,
  };
}

function isConditionalCheckFailed(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ConditionalCheckFailedException";
}

export class DynamoCatalogRepository implements CatalogStore {
  private readonly client = getDynamoDocumentClient();
  private readonly tableName = getRequiredEnv("BOOKS_TABLE_NAME");

  async listBooks(): Promise<Book[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": BOOKS_PARTITION_KEY,
          ":skPrefix": "BOOK#",
        },
      }),
    );

    return (response.Items ?? []).map((item) => toBook(item as CatalogBookItem));
  }

  async listFaqEntries(): Promise<FaqEntry[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": FAQ_PARTITION_KEY,
          ":skPrefix": "FAQ#",
        },
      }),
    );

    return (response.Items ?? [])
      .map((item) => toFaqEntry(item as CatalogFaqItem))
      .filter((entry) => entry.isActive)
      .sort((left, right) => left.order - right.order);
  }

  async listBooksByAuthor(authorName: string): Promise<Book[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        FilterExpression: "authorNormalized = :authorNormalized",
        ExpressionAttributeValues: {
          ":pk": BOOKS_PARTITION_KEY,
          ":skPrefix": "BOOK#",
          ":authorNormalized": normalizeCatalogText(authorName),
        },
      }),
    );

    return (response.Items ?? []).map((item) => toBook(item as CatalogBookItem));
  }

  async createBook(book: Book): Promise<Book> {
    const item: CatalogBookItem = {
      pk: BOOKS_PARTITION_KEY,
      sk: buildCatalogBookSortKey(book),
      entityType: "book",
      ...book,
    };

    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        }),
      );
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        throw new CatalogBookExistsError();
      }

      throw error;
    }

    return book;
  }

  async seedFaqEntries(entries: FaqEntry[]): Promise<void> {
    await Promise.all(
      entries.map((entry) =>
        this.client.send(
          new PutCommand({
            TableName: this.tableName,
            Item: {
              pk: FAQ_PARTITION_KEY,
              sk: buildCatalogFaqSortKey(entry),
              entityType: "faq",
              ...entry,
            } satisfies CatalogFaqItem,
          }),
        ),
      ),
    );
  }
}
