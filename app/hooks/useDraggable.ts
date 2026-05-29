import { useState, useEffect, useRef, useCallback } from "react";

interface Position { x: number; y: number; }

const SNAP_THRESHOLD = 60;
const EDGE_MARGIN = 8;
const DRAG_THRESHOLD_PX = 8;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function snapToEdge(x: number, y: number, w: number, h: number): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const distLeft   = x;
  const distRight  = vw - (x + w);
  const distTop    = y;
  const distBottom = vh - (y + h);
  const minH = Math.min(distLeft, distRight);
  const minV = Math.min(distTop, distBottom);
  let snappedX = x, snappedY = y;
  if (minH < SNAP_THRESHOLD && minH <= minV) {
    snappedX = distLeft < distRight ? EDGE_MARGIN : vw - w - EDGE_MARGIN;
  }
  if (minV < SNAP_THRESHOLD && minV < minH) {
    snappedY = distTop < distBottom ? EDGE_MARGIN : vh - h - EDGE_MARGIN;
  }
  return { x: snappedX, y: snappedY };
}

export function useDraggable(id: string, defaultPos: Position) {
  const getInitialPos = (): Position => {
    try {
      const saved = localStorage.getItem(`widget-pos-${id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultPos;
  };

  const [pos, setPos] = useState<Position>(getInitialPos);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  // Track if the touch started inside a scrollable area (open panel)
  const touchStartInScrollableRef = useRef(false);

  const savePos = useCallback((p: Position) => {
    try { localStorage.setItem(`widget-pos-${id}`, JSON.stringify(p)); } catch {}
  }, [id]);

  const startDrag = useCallback((clientX: number, clientY: number) => {
    dragStartRef.current = { mouseX: clientX, mouseY: clientY, posX: pos.x, posY: pos.y };
    hasDraggedRef.current = false;
  }, [pos]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      if (!hasDraggedRef.current) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;
        hasDraggedRef.current = true;
        setIsDragging(true);
      }

      const el = elementRef.current;
      const w = el?.offsetWidth ?? 50;
      const h = el?.offsetHeight ?? 50;
      const newX = clamp(dragStartRef.current.posX + dx, 0, window.innerWidth - w);
      const newY = clamp(dragStartRef.current.posY + dy, 0, window.innerHeight - h);
      setPos({ x: newX, y: newY });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current) return;
      // If touch started in a scrollable child, don't drag
      if (touchStartInScrollableRef.current) return;

      const client = e.touches[0];
      const dx = client.clientX - dragStartRef.current.mouseX;
      const dy = client.clientY - dragStartRef.current.mouseY;

      if (!hasDraggedRef.current) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;
        hasDraggedRef.current = true;
        setIsDragging(true);
      }

      e.preventDefault();
      const el = elementRef.current;
      const w = el?.offsetWidth ?? 50;
      const h = el?.offsetHeight ?? 50;
      const newX = clamp(dragStartRef.current.posX + dx, 0, window.innerWidth - w);
      const newY = clamp(dragStartRef.current.posY + dy, 0, window.innerHeight - h);
      setPos({ x: newX, y: newY });
    };

    const onEnd = () => {
      if (!dragStartRef.current) return;
      const wasDrag = hasDraggedRef.current;
      dragStartRef.current = null;
      touchStartInScrollableRef.current = false;

      if (!wasDrag) return;

      setIsDragging(false);

      const el = elementRef.current;
      const w = el?.offsetWidth ?? 50;
      const h = el?.offsetHeight ?? 50;

      setPos(current => {
        const snapped = snapToEdge(current.x, current.y, w, h);
        const didSnap = snapped.x !== current.x || snapped.y !== current.y;
        if (didSnap) setIsSnapping(true);
        savePos(snapped);
        return snapped;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [savePos]);

  useEffect(() => {
    if (!isSnapping) return;
    const t = setTimeout(() => setIsSnapping(false), 300);
    return () => clearTimeout(t);
  }, [isSnapping]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // If the touch target is inside a scrollable element (panel content), don't start drag
    const target = e.target as HTMLElement;
    const scrollable = target.closest(
      ".ai-messages, .ai-assistant-panel, .sentiment-panel, .whale-panel, .smartmoney-panel, .frost-trade-widget__body, [data-no-drag]"
    );
    if (scrollable) {
      touchStartInScrollableRef.current = true;
      dragStartRef.current = null;
      return;
    }
    touchStartInScrollableRef.current = false;
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, [startDrag]);

  const isBottomHalf = pos.y > window.innerHeight / 2;
  const wasDragged = useCallback(() => hasDraggedRef.current, []);

  return {
    pos,
    isDragging,
    isSnapping,
    elementRef,
    isBottomHalf,
    wasDragged,
    dragHandleProps: { onMouseDown: handleMouseDown, onTouchStart: handleTouchStart },
  };
}
