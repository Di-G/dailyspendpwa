import { useEffect, useRef } from "react";

type UsePullToRefreshOptions = {
  thresholdPx?: number;
  enabled?: boolean;
  maxPullPx?: number;
  onPullChange?: (pullPx: number, state: "idle" | "pulling" | "refreshing") => void;
  isAuthenticated?: boolean; // Add authentication state awareness
};

export function usePullToRefresh(
  onRefresh: () => void | Promise<void>,
  options: UsePullToRefreshOptions = {}
) {
  const { 
    thresholdPx = 12, 
    enabled = true, 
    maxPullPx = 60, 
    onPullChange,
    isAuthenticated = true // Default to true to maintain backward compatibility
  } = options;
  const startYRef = useRef<number | null>(null);
  const triggeredRef = useRef<boolean>(false);
  const touchingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    if (!("ontouchstart" in window) && navigator.maxTouchPoints === 0) return;
    if (!isAuthenticated) return; // Don't enable pull-to-refresh if user is not authenticated

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return; // Only when at top of the page
      if (e.touches.length !== 1) return;
      startYRef.current = e.touches[0].clientY;
      triggeredRef.current = false;
      touchingRef.current = true;
      onPullChange?.(0, "idle");
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || triggeredRef.current) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;
      if (deltaY > 0 && window.scrollY <= 0) {
        const pullPx = Math.min(maxPullPx, deltaY * 0.5);
        onPullChange?.(pullPx, "pulling");
        if (deltaY >= thresholdPx) {
          triggeredRef.current = true;
          onPullChange?.(pullPx, "refreshing");
          Promise.resolve(onRefresh())
            .catch(() => {})
            .finally(() => {
              // If touch already ended, reset immediately here; otherwise touchend will reset
              if (!touchingRef.current) {
                onPullChange?.(0, "idle");
              }
            });
        }
      }
    };

    const handleTouchEnd = () => {
      startYRef.current = null;
      triggeredRef.current = false;
      touchingRef.current = false;
      onPullChange?.(0, "idle");
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart as any);
      window.removeEventListener("touchmove", handleTouchMove as any);
      window.removeEventListener("touchend", handleTouchEnd as any);
      window.removeEventListener("touchcancel", handleTouchEnd as any);
    };
  }, [onRefresh, thresholdPx, enabled, isAuthenticated]);
}


