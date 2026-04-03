import { promises as fs } from "node:fs";
import path from "node:path";
import type { BookSuggestionAuditEntry } from "../../../../contracts/book-suggestions";
import { getEnv } from "../../../shared/env";

interface BookSuggestionAuditFile {
  entries: BookSuggestionAuditEntry[];
}

const DEFAULT_AUDIT_FILE = path.resolve(
  process.cwd(),
  ".local",
  "lightning-book-suggestions-local.json",
);

function getAuditFilePath(): string {
  return getEnv("LOCAL_BOOK_SUGGESTIONS_FILE") ?? DEFAULT_AUDIT_FILE;
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export class LocalBookSuggestionAuditRepository {
  private readonly auditFilePath = getAuditFilePath();
  private writeChain: Promise<void> = Promise.resolve();

  private async readState(): Promise<BookSuggestionAuditFile> {
    try {
      const contents = await fs.readFile(this.auditFilePath, "utf8");
      const parsed = JSON.parse(contents) as Partial<BookSuggestionAuditFile>;

      return {
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { entries: [] };
      }

      throw error;
    }
  }

  private async writeState(state: BookSuggestionAuditFile): Promise<void> {
    await ensureParentDirectory(this.auditFilePath);
    await fs.writeFile(this.auditFilePath, JSON.stringify(state, null, 2), "utf8");
  }

  async appendEntry(
    entry: BookSuggestionAuditEntry,
  ): Promise<BookSuggestionAuditEntry> {
    this.writeChain = this.writeChain.then(async () => {
      const state = await this.readState();
      await this.writeState({
        entries: [...state.entries, entry],
      });
    });

    await this.writeChain;
    return entry;
  }
}
