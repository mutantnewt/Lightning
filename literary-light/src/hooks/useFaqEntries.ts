import { useEffect, useState } from "react";
import type { FaqEntry } from "@/types";
import { createCatalogClient } from "@/api/catalog";
import { allowLocalRuntimeFallbacks } from "@/config/runtime";
import { faqEntries as localFaqEntries } from "@/data/faq";

const catalogClient = createCatalogClient();

export function useFaqEntries() {
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>(
    allowLocalRuntimeFallbacks() ? localFaqEntries : [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadFaqEntries = async () => {
      try {
        const nextFaqEntries = await catalogClient.listFaqEntries();
        if (isMounted) {
          setFaqEntries(nextFaqEntries);
          setError(null);
        }
      } catch (error) {
        console.error("Error loading FAQ entries:", error);
        if (isMounted) {
          if (allowLocalRuntimeFallbacks()) {
            setFaqEntries(localFaqEntries);
            setError(null);
          } else {
            setFaqEntries([]);
            setError(
              error instanceof Error
                ? error.message
                : "Unable to load frequently asked questions right now.",
            );
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadFaqEntries();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    faqEntries,
    isLoading,
    error,
  };
}
