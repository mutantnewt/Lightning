import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { BookSuggestionAuditEntry } from "../../../../contracts/book-suggestions";
import { getDynamoDocumentClient } from "../../../shared/dynamo";
import { getRequiredEnv } from "../../../shared/env";

interface BookSuggestionAuditItem extends BookSuggestionAuditEntry {
  pk: string;
  sk: string;
  entityType: "bookSuggestionAudit";
}

export class DynamoBookSuggestionAuditRepository {
  private readonly client = getDynamoDocumentClient();
  private readonly tableName = getRequiredEnv("BOOK_SUGGESTIONS_TABLE_NAME");

  async appendEntry(
    entry: BookSuggestionAuditEntry,
  ): Promise<BookSuggestionAuditEntry> {
    const item: BookSuggestionAuditItem = {
      pk: `AUDIT#${entry.id}`,
      sk: `STAGE#${entry.stage}#${entry.createdAt}`,
      entityType: "bookSuggestionAudit",
      ...entry,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );

    return entry;
  }
}
