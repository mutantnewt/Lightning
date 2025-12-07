import { useState } from "react";
import { FaqEntry } from "@/types";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqAccordionProps {
  entries: FaqEntry[];
}

export function FaqAccordion({ entries }: FaqAccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeEntries = entries
    .filter((entry) => entry.isActive)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {activeEntries.map((entry) => {
        const isOpen = openItems.has(entry.id);
        
        return (
          <div
            key={entry.id}
            className="rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-book"
          >
            <button
              onClick={() => toggleItem(entry.id)}
              className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-secondary/30"
              aria-expanded={isOpen}
            >
              <span className="font-serif text-lg font-medium text-foreground pr-4">
                {entry.question}
              </span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            
            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                isOpen ? "max-h-96" : "max-h-0"
              )}
            >
              <div className="border-t border-border bg-secondary/20 p-5">
                <p className="text-base leading-relaxed text-foreground/85">
                  {entry.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
