import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Search, PlusCircle, HelpCircle, LogIn, LogOut, User, Heart, Sparkles, Sun, Moon, Globe, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useCountry, COUNTRIES, CountryCode } from "@/hooks/useCountry";
import { AuthDialog } from "@/components/AuthDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/", label: "Search", icon: Search, authRequired: false },
  { path: "/add-book", label: "Add Book", icon: PlusCircle, authRequired: false },
  { path: "/favorites", label: "Favorites", icon: Heart, authRequired: true },
  { path: "/recommendations", label: "For You", icon: Sparkles, authRequired: true },
  { path: "/moderation", label: "Moderation", icon: ShieldCheck, authRequired: true, moderatorOnly: true },
  { path: "/faq", label: "FAQ", icon: HelpCircle, authRequired: false },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, isAuthenticated, isModerator, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { country, setCountry } = useCountry();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <BookOpen className="h-7 w-7 text-accent flex-shrink-0" />
              <div className="flex flex-col">
                <span className="font-serif text-xl font-semibold text-foreground whitespace-nowrap">
                  Lightning Classics
                </span>
                <span className="text-xs text-muted-foreground hidden lg:inline">
                  Discover timeless works from the world's greatest authors.
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1">
              {navItems
                .filter((item) => {
                  if (item.authRequired && !isAuthenticated) {
                    return false;
                  }

                  if (item.moderatorOnly && !isModerator) {
                    return false;
                  }

                  return true;
                })
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "nav-link flex items-center gap-2 rounded-md",
                        isActive && "active"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  );
                })}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-1 gap-1" title="Select country for Amazon links">
                    <Globe className="h-4 w-4" />
                    <span className="text-xs font-medium">{country}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(COUNTRIES) as CountryCode[]).map((code) => (
                    <DropdownMenuItem
                      key={code}
                      onClick={() => setCountry(code)}
                      className={cn(country === code && "bg-accent/10")}
                    >
                      {COUNTRIES[code].name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="ml-1"
                title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>

              <div className="ml-2 pl-2 border-l border-border">
                {isAuthenticated ? (
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm">
                      <User className="h-4 w-4 text-accent" />
                      <span className="text-foreground">{user?.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={signOut}
                      className="flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">Sign Out</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAuthDialogOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign In / Sign Up</span>
                  </Button>
                )}
              </div>
            </nav>
          </div>
        </div>
      </header>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

      <main className="container mx-auto px-4 py-8 flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card/50 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Lightning Classics. Celebrating public domain literature. No cookies.
          </p>
        </div>
      </footer>
    </div>
  );
}
