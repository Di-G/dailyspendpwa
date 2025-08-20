import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="hover:bg-transparent hover:text-inherit active:bg-accent active:text-accent-foreground"
      onMouseDown={(e) => {
        // Prevent mouse clicks from keeping focus on the button
        e.preventDefault();
      }}
      onClick={(e) => {
        toggleTheme();
        try { (e.currentTarget as HTMLButtonElement).blur(); } catch {}
      }}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </Button>
  );
}
