import { Layout } from "@/components/Layout";
import { FaqAccordion } from "@/components/FaqAccordion";
import { useFaqEntries } from "@/hooks/useFaqEntries";
import { HelpCircle } from "lucide-react";

const FAQ = () => {
  const { faqEntries, isLoading } = useFaqEntries();

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="h-10 w-10 text-accent" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about Lightning Classics and these classic works.
          </p>
        </header>

        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Loading frequently asked questions...
          </div>
        ) : (
          <FaqAccordion entries={faqEntries} />
        )}

        <div className="mt-10 rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Still have questions?
          </h2>
          <p className="mt-2 text-muted-foreground">
            We're here to help. Reach out to us and we'll get back to you as soon as possible.
          </p>
          <a
            href="mailto:hello@lightningclassics.com"
            className="mt-4 inline-flex items-center text-accent hover:text-accent/80 transition-colors font-medium"
          >
            hello@lightningclassics.com
          </a>
        </div>
      </div>
    </Layout>
  );
};

export default FAQ;
