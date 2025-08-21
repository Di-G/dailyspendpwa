import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useRef, useState } from "react";

interface FloatingActionButtonProps {
  onClick: () => void;
  colorVariant?: 'primary' | 'rose' | 'emerald';
  disabled?: boolean;
}

export default function FloatingActionButton({ onClick, colorVariant = 'primary', disabled = false }: FloatingActionButtonProps) {
  const isMobile = useIsMobile();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const movedRef = useRef(false);
  const offsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup listeners if any remain
      window.removeEventListener("pointermove", handlePointerMove as any);
      window.removeEventListener("pointerup", handlePointerUp as any);
      window.removeEventListener("pointercancel", handlePointerUp as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Initialize absolute position if currently centered via CSS
    if (position == null) {
      setPosition({ left: rect.left, top: rect.top });
    }
    sizeRef.current = { width: rect.width, height: rect.height };
    offsetRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    startRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = true;
    movedRef.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    window.addEventListener("pointermove", handlePointerMove as any);
    window.addEventListener("pointerup", handlePointerUp as any);
    window.addEventListener("pointercancel", handlePointerUp as any);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    const { dx, dy } = offsetRef.current;
    const { width, height } = sizeRef.current;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nextLeft = e.clientX - dx;
    let nextTop = e.clientY - dy;
    nextLeft = Math.max(margin, Math.min(nextLeft, vw - width - margin));
    nextTop = Math.max(margin, Math.min(nextTop, vh - height - margin));
    setPosition({ left: nextLeft, top: nextTop });
    if (!movedRef.current && startRef.current) {
      const dxTot = e.clientX - startRef.current.x;
      const dyTot = e.clientY - startRef.current.y;
      if (dxTot * dxTot + dyTot * dyTot > 16) {
        movedRef.current = true;
      }
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    window.removeEventListener("pointermove", handlePointerMove as any);
    window.removeEventListener("pointerup", handlePointerUp as any);
    window.removeEventListener("pointercancel", handlePointerUp as any);
    const wasDragging = isDraggingRef.current;
    const didMove = movedRef.current;
    isDraggingRef.current = false;
    movedRef.current = false;
    startRef.current = null;
    if (wasDragging && !didMove) {
      // Treat as a tap
      onClick();
    }
  };

  if (!isMobile) {
    return null; // Only show on mobile devices
  }

  const commonClass = "fixed z-40 will-change-transform select-none";
  const centeredClass = "bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 -translate-x-1/2";
  const style = position
    ? { left: `${position.left}px`, top: `${position.top}px`, touchAction: "none" as const }
    : { touchAction: "none" as const };

  return (
    <div
      ref={containerRef}
      className={`${commonClass} ${position ? "" : centeredClass}`}
      style={style}
      onPointerDown={handlePointerDown}
    >
      <Button
        // Prevent accidental click after drag
        onClick={(e) => {
          if (isDraggingRef.current || movedRef.current) return;
          onClick();
        }}
        size="lg"
        disabled={disabled}
        className={`w-20 h-20 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 ${
          colorVariant === 'rose'
            ? 'bg-rose-600 hover:bg-rose-700'
            : colorVariant === 'emerald'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-primary hover:bg-blue-700'
        }`}
      >
        <Plus className="w-10 h-10" />
      </Button>
    </div>
  );
}
