import { BookOpen, BookMarked, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReadingLists, ReadingListType } from "@/hooks/useReadingLists";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReadingListDropdownProps {
  bookId: string;
  bookTitle: string;
}

const listOptions: {
  type: ReadingListType;
  label: string;
  icon: typeof BookOpen;
}[] = [
  { type: "wantToRead", label: "Want to Read", icon: BookOpen },
  { type: "currentlyReading", label: "Currently Reading", icon: BookMarked },
  { type: "finished", label: "Finished", icon: CheckCircle2 },
];

export function ReadingListDropdown({
  bookId,
  bookTitle,
}: ReadingListDropdownProps) {
  const { user, isAuthenticated } = useAuth();
  const { getBookList, addToList, removeFromList, error } = useReadingLists(user?.id);
  const { toast } = useToast();
  const currentList = getBookList(bookId);

  const handleListChange = async (listType: ReadingListType) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to manage reading lists",
        variant: "destructive",
      });
      return;
    }

    if (currentList === listType) {
      try {
        await removeFromList(bookId);
        toast({
          title: "Removed from list",
          description: `"${bookTitle}" has been removed from your reading list`,
        });
      } catch (error) {
        toast({
          title: "Unable to update reading list",
          description:
            error instanceof Error
              ? error.message
              : "Something went wrong while saving your reading list.",
          variant: "destructive",
        });
      }
      return;
    }

    try {
      await addToList(bookId, listType);
      const option = listOptions.find((opt) => opt.type === listType);
      toast({
        title: "Added to list",
        description: `"${bookTitle}" has been added to ${option?.label}`,
      });
    } catch (error) {
      toast({
        title: "Unable to update reading list",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong while saving your reading list.",
        variant: "destructive",
      });
    }
  };

  const currentOption = listOptions.find((opt) => opt.type === currentList);

  if (error) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        disabled
        title={error}
      >
        <BookOpen className="h-4 w-4" />
        Lists unavailable
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={currentList ? "default" : "outline"}
          size="sm"
          className="flex items-center gap-2"
        >
          {currentOption ? (
            <>
              <currentOption.icon className="h-4 w-4" />
              {currentOption.label}
            </>
          ) : (
            <>
              <BookOpen className="h-4 w-4" />
              Add to List
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {listOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentList === option.type;
          return (
            <DropdownMenuItem
              key={option.type}
              onClick={() => handleListChange(option.type)}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                isActive && "bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {option.label}
              {isActive && <CheckCircle2 className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
