import { useEffect, useState } from "react";
import type { FaqEntry } from "@/types";
import { createCatalogClient } from "@/api/catalog";
import { faqEntries as localFaqEntries } from "@/data/faq";

const catalogClient = createCatalogClient();

export function useFaqEntries() {
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>(localFaqEntries);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadFaqEntries = async () => {
      try {
        const nextFaqEntries = await catalogClient.listFaqEntries();
        if (isMounted) {
          setFaqEntries(nextFaqEntries);
        }
      } catch (error) {
        console.error("Error loading FAQ entries:", error);
        if (isMounted) {
          setFaqEntries(localFaqEntries);
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
  };
}
