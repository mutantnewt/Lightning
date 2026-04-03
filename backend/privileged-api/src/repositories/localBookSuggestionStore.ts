import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BookSuggestionAuditEntry,
  BookSuggestionSubmission,
} from "../../../../contracts/book-suggestions";
import { getEnv } from "../../../shared/env";
import type {
  AcceptBookSuggestionSubmissionInput,
  BookSuggestionStore,
  ModerateBookSuggestionSubmissionInput,
} from "./bookSuggestionStore";

interface BookSuggestionFile {
  entries: BookSuggestionAuditEntry[];
  submissions: BookSuggestionSubmission[];
}

const DEFAULT_STORE_FILE = path.resolve(
  process.cwd(),
  ".local",
  "lightning-book-suggestions-local.json",
);

function getStoreFilePath(): string {
  return getEnv("LOCAL_BOOK_SUGGESTIONS_FILE") ?? DEFAULT_STORE_FILE;
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export class LocalBookSuggestionStore implements BookSuggestionStore {
  private readonly storeFilePath = getStoreFilePath();
  private writeChain: Promise<void> = Promise.resolve();

  private async readState(): Promise<BookSuggestionFile> {
    try {
      const contents = await fs.readFile(this.storeFilePath, "utf8");
      const parsed = JSON.parse(contents) as Partial<BookSuggestionFile>;

      return {
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { entries: [], submissions: [] };
      }

      throw error;
    }
  }

  private async writeState(state: BookSuggestionFile): Promise<void> {
    await ensureParentDirectory(this.storeFilePath);
    await fs.writeFile(this.storeFilePath, JSON.stringify(state, null, 2), "utf8");
  }

  async appendEntry(
    entry: BookSuggestionAuditEntry,
  ): Promise<BookSuggestionAuditEntry> {
    this.writeChain = this.writeChain.then(async () => {
      const state = await this.readState();
      await this.writeState({
        entries: [...state.entries, entry],
        submissions: state.submissions,
      });
    });

    await this.writeChain;
    return entry;
  }

  async createSubmission(
    submission: BookSuggestionSubmission,
  ): Promise<BookSuggestionSubmission> {
    this.writeChain = this.writeChain.then(async () => {
      const state = await this.readState();
      await this.writeState({
        entries: state.entries,
        submissions: [...state.submissions, submission],
      });
    });

    await this.writeChain;
    return submission;
  }

  async listSubmissionsByStatus(
    status: BookSuggestionSubmission["status"],
  ): Promise<BookSuggestionSubmission[]> {
    const state = await this.readState();

    return state.submissions
      .filter((submission) => submission.status === status)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getSubmissionById(
    submissionId: string,
  ): Promise<BookSuggestionSubmission | null> {
    const state = await this.readState();
    return state.submissions.find((submission) => submission.id === submissionId) ?? null;
  }

  async markSubmissionAccepted(
    input: AcceptBookSuggestionSubmissionInput,
  ): Promise<BookSuggestionSubmission | null> {
    let updatedSubmission: BookSuggestionSubmission | null = null;

    this.writeChain = this.writeChain.then(async () => {
      const state = await this.readState();

      const submissions = state.submissions.map((submission) => {
        if (submission.id !== input.submissionId) {
          return submission;
        }

        updatedSubmission = {
          ...submission,
          status: "accepted",
          updatedAt: input.acceptedAt,
          moderationNotes: input.moderationNotes,
          lastModeratedAt: input.acceptedAt,
          lastModeratedByUserId: input.acceptedByUserId,
          decisionAuditEntryId: input.acceptedAuditEntryId,
          acceptedAt: input.acceptedAt,
          acceptedByUserId: input.acceptedByUserId,
          acceptedBookId: input.acceptedBookId,
          acceptedAuditEntryId: input.acceptedAuditEntryId,
        };

        return updatedSubmission;
      });

      await this.writeState({
        entries: state.entries,
        submissions,
      });
    });

    await this.writeChain;
    return updatedSubmission;
  }

  async markSubmissionModerated(
    input: ModerateBookSuggestionSubmissionInput,
  ): Promise<BookSuggestionSubmission | null> {
    let updatedSubmission: BookSuggestionSubmission | null = null;

    this.writeChain = this.writeChain.then(async () => {
      const state = await this.readState();

      const submissions = state.submissions.map((submission) => {
        if (submission.id !== input.submissionId) {
          return submission;
        }

        updatedSubmission = {
          ...submission,
          status: input.status,
          updatedAt: input.moderatedAt,
          moderationNotes: input.moderationNotes,
          lastModeratedAt: input.moderatedAt,
          lastModeratedByUserId: input.moderatedByUserId,
          decisionAuditEntryId: input.decisionAuditEntryId,
          acceptedAt: null,
          acceptedByUserId: null,
          acceptedBookId: null,
          acceptedAuditEntryId: null,
        };

        return updatedSubmission;
      });

      await this.writeState({
        entries: state.entries,
        submissions,
      });
    });

    await this.writeChain;
    return updatedSubmission;
  }
}
