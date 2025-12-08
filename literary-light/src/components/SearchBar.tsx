import { useState, FormEvent } from "react";
import { Search, RotateCcw, Shuffle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onReset: () => void;
  onRandom?: () => void;
  initialQuery?: string;
  totalBooks?: number;
}

export function SearchBar({ onSearch, onReset, onRandom, initialQuery = "", totalBooks = 0 }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleReset = () => {
    setQuery("");
    onReset();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1" style={{ minWidth: '20px' }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${totalBooks} books...`}
            className="input-classic h-12 pl-10 text-base w-full"
            style={{ minWidth: 0 }}
          />
        </div>
        <Button type="submit" className="btn-primary h-12 px-4 sm:px-6 flex-shrink-0">
          <Search className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Search</span>
        </Button>
        {onRandom && (
          <Button type="button" onClick={onRandom} className="btn-accent h-12 px-4 sm:px-6 flex-shrink-0">
            <Shuffle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Random</span>
          </Button>
        )}
        <Button type="button" onClick={handleReset} variant="outline" className="h-12 px-4 sm:px-6 flex-shrink-0">
          <RotateCcw className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>
    </form>
  );
}
