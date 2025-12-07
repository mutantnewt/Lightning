import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

export interface SearchFiltersState {
  era: string | null;
  country: string | null;
  category: string | null;
  workType: string | null;
}

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onChange: (filters: SearchFiltersState) => void;
  eras: string[];
  countries: string[];
  categories: string[];
  workTypes: string[];
}

export function SearchFilters({
  filters,
  onChange,
  eras,
  countries,
  categories,
  workTypes,
}: SearchFiltersProps) {
  const hasActiveFilters =
    filters.era || filters.country || filters.category || filters.workType;

  const clearAllFilters = () => {
    onChange({ era: null, country: null, category: null, workType: null });
  };

  const updateFilter = (key: keyof SearchFiltersState, value: string | null) => {
    onChange({ ...filters, [key]: value === "all" ? null : value });
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Select
        value={filters.era || "all"}
        onValueChange={(value) => updateFilter("era", value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Eras" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Eras</SelectItem>
          {eras.map((era) => (
            <SelectItem key={era} value={era}>
              {era}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.country || "all"}
        onValueChange={(value) => updateFilter("country", value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Countries" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Countries</SelectItem>
          {countries.map((country) => (
            <SelectItem key={country} value={country}>
              {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.category || "all"}
        onValueChange={(value) => updateFilter("category", value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.workType || "all"}
        onValueChange={(value) => updateFilter("workType", value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Work Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Work Types</SelectItem>
          {workTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="gap-1"
        >
          <X className="h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
