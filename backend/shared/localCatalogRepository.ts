import { promises as fs } from "node:fs";
import path from "node:path";
import { seedCatalogBooks, seedFaqEntries } from "../../contracts/catalog-seed";
import type { Book, FaqEntry } from "../../contracts/domain";
import { getEnv } from "./env";
import { getCatalogTitleAuthorKey } from "./catalogIdentity";
import {
  CatalogBookExistsError,
  type CatalogStore,
} from "./catalogTypes";

interface CatalogFileState {
  books: Book[];
  faqEntries: FaqEntry[];
}

const DEFAULT_CATALOG_FILE = path.resolve(
  process.cwd(),
  ".local",
  "lightning-catalog-local.json",
);

function getCatalogFilePath(): string {
  return getEnv("LOCAL_CATALOG_FILE") ?? DEFAULT_CATALOG_FILE;
}

function sortBooks(books: Book[]): Book[] {
  return [...books].sort((left, right) => left.title.localeCompare(right.title));
}

function getSeedState(): CatalogFileState {
  return {
    books: sortBooks(seedCatalogBooks),
    faqEntries: [...seedFaqEntries].sort((left, right) => left.order - right.order),
  };
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export class LocalCatalogRepository implements CatalogStore {
  private readonly catalogFilePath = getCatalogFilePath();
  private writeChain: Promise<void> = Promise.resolve();

  private async readState(): Promise<CatalogFileState> {
    try {
      const contents = await fs.readFile(this.catalogFilePath, "utf8");
      const parsed = JSON.parse(contents) as Partial<CatalogFileState>;

      return {
        books: Array.isArray(parsed.books) ? sortBooks(parsed.books) : sortBooks(seedCatalogBooks),
        faqEntries: Array.isArray(parsed.faqEntries)
          ? [...parsed.faqEntries].sort((left, right) => left.order - right.order)
          : [...seedFaqEntries].sort((left, right) => left.order - right.order),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return getSeedState();
      }

      throw error;
    }
  }

  private async writeState(state: CatalogFileState): Promise<void> {
    await ensureParentDirectory(this.catalogFilePath);
    await fs.writeFile(this.catalogFilePath, JSON.stringify(state, null, 2), "utf8");
  }

  async listBooks(): Promise<Book[]> {
    const state = await this.readState();
    return sortBooks(state.books);
  }

  async listFaqEntries(): Promise<FaqEntry[]> {
    const state = await this.readState();
    return [...state.faqEntries]
      .filter((entry) => entry.isActive)
      .sort((left, right) => left.order - right.order);
  }

  async listBooksByAuthor(authorName: string): Promise<Book[]> {
    const state = await this.readState();
    return sortBooks(state.books.filter((book) => book.author === authorName));
  }

  async createBook(book: Book): Promise<Book> {
    this.writeChain = this.writeChain.then(async () => {
      const state = await this.readState();

      const candidateKey = getCatalogTitleAuthorKey(book);

      if (
        state.books.some(
          (existingBook) =>
            getCatalogTitleAuthorKey(existingBook) === candidateKey,
        )
      ) {
        throw new CatalogBookExistsError();
      }

      await this.writeState({
        books: sortBooks([...state.books, book]),
        faqEntries: state.faqEntries,
      });
    });

    await this.writeChain;
    return book;
  }
}
