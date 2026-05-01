"use client";

import { useCallback, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import type { MobileLayout } from "@/lib/types/grid";

interface MobileDraggableTileProps {
  id: string;
  mobileLayout: MobileLayout;
  gridMeta: { colWidth: number; rowHeight: number };
  onResize: (id: string, layout: Partial<MobileLayout>) => void;
  children: React.ReactNode;
  className?: string;
  autoHeight?: boolean;
}

export function MobileDraggableTile({
  id,
  mobileLayout,
  gridMeta,
  onResize,
  children,
  className,
  autoHeight,
}: MobileDraggableTileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoHeight) return;
    const el = contentRef.current;
    if (!el) return;

    function measure() {
      const grid = el!.closest("[data-bento-grid]") as HTMLElement | null;
      if (!grid) return;
      const rowHeight = parseFloat(grid.style.gridAutoRows);
      if (!rowHeight || isNaN(rowHeight)) return;
      const gap = 12;
      const dragHandleHeight = 24;
      const contentHeight = el!.scrollHeight + dragHandleHeight;
      const needed = Math.ceil((contentHeight + gap) / (rowHeight + gap));
      if (needed > mobileLayout.rowSpan) {
        onResize(id, { rowSpan: needed });
      }
    }

    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoHeight, id, mobileLayout.rowSpan, onResize]);

  const handleResizeCorner = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const startColSpan = mobileLayout.colSpan;
      const startRowSpan = mobileLayout.rowSpan;
      let lastColSpan = startColSpan;
      let lastRowSpan = startRowSpan;
      const gap = 12;

      function onMove(ev: PointerEvent) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const colDelta = Math.round(dx / (gridMeta.colWidth + gap));
        const rowDelta = Math.round(dy / (gridMeta.rowHeight + gap));
        const newColSpan = Math.max(1, Math.min(3 - mobileLayout.colStart, startColSpan + colDelta));
        const newRowSpan = Math.max(1, startRowSpan + rowDelta);
        if (newColSpan !== lastColSpan || newRowSpan !== lastRowSpan) {
          lastColSpan = newColSpan;
          lastRowSpan = newRowSpan;
          onResize(id, { colSpan: newColSpan, rowSpan: newRowSpan });
        }
      }

      function onUp() {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
      }

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
    },
    [id, mobileLayout, gridMeta, onResize]
  );

  const style = {
    gridColumn: `${mobileLayout.colStart} / span ${mobileLayout.colSpan}`,
    gridRow: `${mobileLayout.rowStart} / span ${mobileLayout.rowSpan}`,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <motion.div
      ref={setNodeRef}
      // 1. Layout handles 100% of spatial positioning
      layout 
      style={style}
      className={`group/tile relative ${autoHeight ? "" : "overflow-hidden"} rounded-[15px] bg-bg ${className ?? ""}`}
      initial={{ opacity: 0, scale: 0.8 }}
      // 2. Explicitly animate ONLY visuals (opacity, scale). No x or y!
      animate={{ opacity: isDragging ? 0.7 : 1, scale: isDragging ? 1.03 : 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
      transition={{ 
        layout: { type: "spring", stiffness: 200, damping: 18, mass: 1.2 },
        scale: { type: "spring", stiffness: 300, damping: 15 },
        opacity: { duration: 0.2 }
      }}
      // 3. THE FIX: Inject dnd-kit's drag offset cleanly into the CSS.
      // When dropped, this vanishes instantly, and `layout` seamlessly springs from the gap!
      transformTemplate={(_, generatedTransform) => {
        if (isDragging && transform) {
          return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0) ${generatedTransform}`;
        }
        return generatedTransform;
      }}
    >
      <div
        {...listeners}
        {...attributes}
        style={{ touchAction: "none" }}
        className="flex h-6 cursor-grab items-center justify-center border-b border-primary/30 active:cursor-grabbing"
      >
        <div className="flex gap-0.5">
          <span className="size-1 rounded-full bg-text/20" />
          <span className="size-1 rounded-full bg-text/20" />
          <span className="size-1 rounded-full bg-text/20" />
        </div>
      </div>

      <div ref={contentRef} className={autoHeight ? "" : "h-[calc(100%-24px)] overflow-auto"}>{children}</div>

      <div
        onPointerDown={handleResizeCorner}
        style={{ touchAction: "none" }}
        className="absolute bottom-1 right-1 flex size-6 cursor-nwse-resize items-center justify-center rounded-sm"
      >
        <svg viewBox="0 0 10 10" className="size-3 text-text/30">
          {/* Soft curved corner: Starts at (9,2), curves toward (9,9), ends at (2,9) */}
          <path 
            d="M9 2 Q9 9 2 9" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
          />
        </svg>
      </div>
    </motion.div>
  );
}