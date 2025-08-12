import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export default function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return null; // Only show on mobile devices
  }

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40">
      <Button
        onClick={onClick}
        size="lg"
        className="w-16 h-16 rounded-full bg-primary hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
      >
        <Plus className="w-8 h-8" />
      </Button>
    </div>
  );
}
