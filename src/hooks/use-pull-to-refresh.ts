import { useEffect, useRef } from "react";

type UsePullToRefreshOptions = {
  thresholdPx?: number;
  enabled?: boolean;
};

export function usePullToRefresh(
  onRefresh: () => void | Promise<void>,
  options: UsePullToRefreshOptions = {}
) {
  const { thresholdPx = 12, enabled = true } = options;
  const startYRef = useRef<number | null>(null);
  const triggeredRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    if (!("ontouchstart" in window) && navigator.maxTouchPoints === 0) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return; // Only when at top of the page
      if (e.touches.length !== 1) return;
      startYRef.current = e.touches[0].clientY;
      triggeredRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || triggeredRef.current) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;
      if (deltaY >= thresholdPx && window.scrollY <= 0) {
        triggeredRef.current = true;
        Promise.resolve(onRefresh()).catch(() => {});
      }
    };

    const handleTouchEnd = () => {
      startYRef.current = null;
      triggeredRef.current = false;
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
  }, [onRefresh, thresholdPx, enabled]);
}


