import { useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useModerationQueue } from "@/hooks/useModerationQueue";
import { useToast } from "@/hooks/use-toast";

function formatTimestamp(value: string): string {
  try {
    return format(new Date(value), "d MMM yyyy, HH:mm");
  } catch {
    return value;
  }
}

export default function Moderation() {
  const { isAuthenticated, isModerator } = useAuth();
  const { toast } = useToast();
  const {
    submissions,
    isLoading,
    error,
    reload,
    acceptSubmission,
    deferSubmission,
    rejectSubmission,
  } = useModerationQueue(isAuthenticated && isModerator);
  const [activeDecision, setActiveDecision] = useState<{
    submissionId: string;
    action: "accept" | "defer" | "reject";
  } | null>(null);
  const [moderationNotes, setModerationNotes] = useState<Record<string, string>>({});

  const getModerationNote = (submissionId: string): string =>
    moderationNotes[submissionId] ?? "";

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 shadow-book">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <h1 className="font-serif text-2xl font-semibold text-foreground">
                Moderation
              </h1>
              <p className="mt-2 text-muted-foreground">
                Sign in with a moderator account to review pending Add Book submissions.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isModerator) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 shadow-book">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <h1 className="font-serif text-2xl font-semibold text-foreground">
                Moderation
              </h1>
              <p className="mt-2 text-muted-foreground">
                This area is reserved for catalog moderators. Shared catalog publication is
                restricted to the `lightning-catalog-moderators-{"<env>"}` Cognito group.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Moderation Queue
            </h1>
            <p className="mt-2 text-muted-foreground">
              Review pending Add Book submissions and publish approved records into the shared
              catalog.
            </p>
          </div>
          <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </header>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center shadow-book">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
            <p className="mt-3 text-sm text-muted-foreground">
              Loading pending submissions...
            </p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center shadow-book">
            <CheckCircle2 className="mx-auto h-8 w-8 text-accent" />
            <p className="mt-3 text-sm text-muted-foreground">
              No pending book submissions need review right now.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => {
              const note = getModerationNote(submission.id);
              const trimmedNote = note.trim();
              const isApproving =
                activeDecision?.submissionId === submission.id &&
                activeDecision.action === "accept";
              const isDeferring =
                activeDecision?.submissionId === submission.id &&
                activeDecision.action === "defer";
              const isRejecting =
                activeDecision?.submissionId === submission.id &&
                activeDecision.action === "reject";
              const isBusy = activeDecision?.submissionId === submission.id;

              return (
                <article
                  key={submission.id}
                  className="rounded-lg border border-border bg-card p-6 shadow-book"
                  data-testid="moderation-submission-card"
                  data-submission-id={submission.id}
                  data-book-title={submission.book.title ?? "Untitled"}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div>
                        <h2 className="font-serif text-2xl font-semibold text-foreground">
                          {submission.book.title ?? "Untitled"}
                        </h2>
                        <p className="text-muted-foreground">
                          by {submission.book.author ?? "Unknown"}
                        </p>
                      </div>

                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <p>Requested by: {submission.requestedBy.name}</p>
                        <p>Email: {submission.requestedBy.email}</p>
                        <p>Submitted: {formatTimestamp(submission.createdAt)}</p>
                        <p>Source: {submission.source}</p>
                      </div>

                      {submission.book.publicDomainNotes && (
                        <div className="rounded-md bg-secondary/50 p-3 text-sm">
                          <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                            Copyright Status
                          </p>
                          <p className="mt-1 text-foreground/90">
                            {submission.book.publicDomainNotes}
                          </p>
                        </div>
                      )}

                      {submission.book.summary && (
                        <div className="rounded-md bg-secondary/50 p-3 text-sm">
                          <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                            Summary
                          </p>
                          <p className="mt-1 text-foreground/90">
                            {submission.book.summary}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label
                          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          htmlFor={`moderation-notes-${submission.id}`}
                        >
                          Moderator Notes
                        </label>
                        <Textarea
                          id={`moderation-notes-${submission.id}`}
                          data-testid={`moderation-notes-${submission.id}`}
                          placeholder="Add context for defer or reject decisions. Approval notes are optional."
                          value={note}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setModerationNotes((current) => ({
                              ...current,
                              [submission.id]: nextValue,
                            }));
                          }}
                          disabled={isBusy}
                          className="min-h-[112px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Notes are required for defer and reject decisions.
                        </p>
                      </div>
                    </div>

                    <div className="lg:w-56 lg:space-y-3">
                      <Button
                        className="w-full btn-accent"
                        data-testid={`approve-submission-${submission.id}`}
                        disabled={isBusy}
                        onClick={() => {
                          setActiveDecision({
                            submissionId: submission.id,
                            action: "accept",
                          });

                          void acceptSubmission(submission, trimmedNote || null)
                            .then((result) => {
                              toast({
                                title: "Submission published",
                                description: `"${result.book.title}" is now live in Lightning Classics.`,
                              });
                            })
                            .catch((acceptError) => {
                              toast({
                                title: "Unable to publish submission",
                                description:
                                  acceptError instanceof Error
                                    ? acceptError.message
                                    : "An unexpected error occurred.",
                                variant: "destructive",
                              });
                            })
                            .finally(() => {
                              setActiveDecision((current) =>
                                current?.submissionId === submission.id ? null : current,
                              );
                            });
                        }}
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Approve and publish
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full"
                        data-testid={`defer-submission-${submission.id}`}
                        disabled={isBusy || !trimmedNote}
                        onClick={() => {
                          setActiveDecision({
                            submissionId: submission.id,
                            action: "defer",
                          });

                          void deferSubmission(submission, trimmedNote)
                            .then(() => {
                              toast({
                                title: "Submission deferred",
                                description: `"${submission.book.title}" has been deferred for follow-up review.`,
                              });
                            })
                            .catch((moderationError) => {
                              toast({
                                title: "Unable to defer submission",
                                description:
                                  moderationError instanceof Error
                                    ? moderationError.message
                                    : "An unexpected error occurred.",
                                variant: "destructive",
                              });
                            })
                            .finally(() => {
                              setActiveDecision((current) =>
                                current?.submissionId === submission.id ? null : current,
                              );
                            });
                        }}
                      >
                        {isDeferring ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deferring...
                          </>
                        ) : (
                          <>
                            <Clock3 className="mr-2 h-4 w-4" />
                            Defer review
                          </>
                        )}
                      </Button>

                      <Button
                        variant="destructive"
                        className="w-full"
                        data-testid={`reject-submission-${submission.id}`}
                        disabled={isBusy || !trimmedNote}
                        onClick={() => {
                          setActiveDecision({
                            submissionId: submission.id,
                            action: "reject",
                          });

                          void rejectSubmission(submission, trimmedNote)
                            .then(() => {
                              toast({
                                title: "Submission rejected",
                                description: `"${submission.book.title}" has been rejected and removed from the pending queue.`,
                              });
                            })
                            .catch((moderationError) => {
                              toast({
                                title: "Unable to reject submission",
                                description:
                                  moderationError instanceof Error
                                    ? moderationError.message
                                    : "An unexpected error occurred.",
                                variant: "destructive",
                              });
                            })
                            .finally(() => {
                              setActiveDecision((current) =>
                                current?.submissionId === submission.id ? null : current,
                              );
                            });
                        }}
                      >
                        {isRejecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject submission
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
