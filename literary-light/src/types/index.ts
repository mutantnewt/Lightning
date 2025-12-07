export type WorkType = "Novel" | "Play" | "Poem" | "Essay" | "Collection" | "Short Story" | "Other";

export type Book = {
  id: string;
  title: string;
  author: string;
  year?: number | null;
  era?: string | null;
  country?: string | null;
  category?: string | null;
  workType: WorkType;
  summary: string;
  authorBio: string;
  tags: string[];
  source?: string | null;
  publicDomain: boolean;
  publicDomainNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  searchIndex?: string;
  titleNormalized?: string;
  authorNormalized?: string;
};

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
};
