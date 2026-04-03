import { useEffect, useState } from "react";
import type { BookSuggestionSubmission } from "@contracts/book-suggestions";
import { createModerationClient } from "@/api/moderation";

const moderationClient = createModerationClient();

export function useModerationQueue(enabled: boolean) {
  const [submissions, setSubmissions] = useState<BookSuggestionSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const loadSubmissions = async () => {
    if (!enabled) {
      setSubmissions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const nextSubmissions = await moderationClient.listPendingSubmissions();
      setSubmissions(nextSubmissions);
      setError(null);
    } catch (loadError) {
      console.error("Error loading moderation submissions:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load pending submissions.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmissions();
  }, [enabled]);

  const acceptSubmission = async (
    submission: BookSuggestionSubmission,
    moderationNotes?: string | null,
  ) => {
    const accepted = await moderationClient.acceptSubmission(
      submission,
      moderationNotes,
    );
    setSubmissions((current) =>
      current.filter((candidate) => candidate.id !== submission.id),
    );

    return accepted;
  };

  const deferSubmission = async (
    submission: BookSuggestionSubmission,
    moderationNotes: string,
  ) => {
    const moderated = await moderationClient.deferSubmission(submission, moderationNotes);
    setSubmissions((current) =>
      current.filter((candidate) => candidate.id !== submission.id),
    );

    return moderated;
  };

  const rejectSubmission = async (
    submission: BookSuggestionSubmission,
    moderationNotes: string,
  ) => {
    const moderated = await moderationClient.rejectSubmission(submission, moderationNotes);
    setSubmissions((current) =>
      current.filter((candidate) => candidate.id !== submission.id),
    );

    return moderated;
  };

  return {
    submissions,
    isLoading,
    error,
    reload: loadSubmissions,
    acceptSubmission,
    deferSubmission,
    rejectSubmission,
  };
}
