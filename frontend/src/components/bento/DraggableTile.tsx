"use client";

import { useCallback, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import type { DesktopLayout, MobileLayout } from "@/lib/types/grid";
import type { BlockStyle } from "@/lib/types/blocks";
import { isDarkColor } from "@/lib/constants/colors";

interface DraggableTileProps {
  id: string;
  desktopLayout: DesktopLayout;
  mobileLayout: MobileLayout;
  gridMeta: { colWidth: number; rowHeight: number };
  onResize: (id: string, layout: Partial<DesktopLayout>) => void;
  children: React.ReactNode;
  className?: string;
  autoHeight?: boolean;
  zIndex?: number;
  withBorder?: boolean;
  blockStyle?: BlockStyle;
  onSelect?: () => void;
  isSelected?: boolean;
}

export function DraggableTile({
  id,
  desktopLayout,
  gridMeta,
  onResize,
  children,
  className,
  autoHeight,
  zIndex,
  withBorder,
  blockStyle,
  onSelect,
  isSelected,
}: DraggableTileProps) {
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
      const gap = 16;
      const dragHandleHeight = 24;
      const contentHeight = el!.scrollHeight + dragHandleHeight;
      const needed = Math.ceil((contentHeight + gap) / (rowHeight + gap));
      if (needed > desktopLayout.rowSpan) {
        onResize(id, { rowSpan: needed });
      }
    }

    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoHeight, id, desktopLayout.rowSpan, onResize]);

  const handleResizeCorner = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const startColSpan = desktopLayout.colSpan;
      const startRowSpan = desktopLayout.rowSpan;
      let lastColSpan = startColSpan;
      let lastRowSpan = startRowSpan;
      const gap = 16;

      function onMove(ev: PointerEvent) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const colDelta = Math.round(dx / (gridMeta.colWidth + gap));
        const rowDelta = Math.round(dy / (gridMeta.rowHeight + gap));
        const newColSpan = Math.max(1, Math.min(5 - desktopLayout.colStart, startColSpan + colDelta));
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
    [id, desktopLayout, gridMeta, onResize]
  );

  const style = {
    gridColumn: `${desktopLayout.colStart} / span ${desktopLayout.colSpan}`,
    gridRow: `${desktopLayout.rowStart} / span ${desktopLayout.rowSpan}`,
    // x and y removed from here to allow Framer Motion to interpolate them
    zIndex: isDragging ? 50 : (zIndex || undefined),
  };

  // Define the master spring configuration so it can be perfectly matched
  const springConfig = { type: "spring" as const, stiffness: 200, damping: 18, mass: 1.2 };

  const borderless = blockStyle?.borderless;
  const bgColor = blockStyle?.background_color;
  const borderClass =
    withBorder && !borderless
      ? isSelected
        ? "border border-accent"
        : "border border-primary"
      : isSelected
        ? "border border-accent"
        : "";
  const bgClass = bgColor ? "" : "bg-bg";
  const dark = isDarkColor(bgColor);
  const mergedStyle = {
    ...style,
    ...(bgColor ? { backgroundColor: bgColor } : {}),
    ...(dark ? { color: "#eff1f3" } : {}),
  };

  return (
    <motion.div
      ref={setNodeRef}
      layout // Always on to maintain layout projection context
      data-block-id={id}
      style={mergedStyle}
      onClick={(e) => {
        if (!onSelect) return;
        if ((e.target as HTMLElement).closest("button")) return;
        onSelect();
      }}
      className={`group/tile relative ${autoHeight ? "" : "overflow-hidden"} rounded-[15px] ${bgClass} ${borderClass} ${className ?? ""}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        // Track the cursor perfectly during drag, animate to 0 when dropped
        x: isDragging ? (transform?.x ?? 0) : 0, 
        y: isDragging ? (transform?.y ?? 0) : 0, 
        opacity: isDragging ? 0.7 : 1, 
        scale: isDragging ? 1.03 : 1 
      }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
      transition={{ 
        // The magic happens here: x, y, and layout MUST share the exact same spring configuration on drop
        layout: isDragging ? { duration: 0 } : springConfig,
        x: isDragging ? { duration: 0 } : springConfig, 
        y: isDragging ? { duration: 0 } : springConfig, 
        scale: { type: "spring", stiffness: 300, damping: 15 },
        opacity: { duration: 0.2 }
      }}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className={`flex h-6 cursor-grab items-center justify-center active:cursor-grabbing ${borderless ? "" : "border-b border-primary/30"}`}
      >
        <div className="flex gap-0.5">
          <span className="size-1 rounded-full bg-text/20" />
          <span className="size-1 rounded-full bg-text/20" />
          <span className="size-1 rounded-full bg-text/20" />
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className={autoHeight ? "" : "h-[calc(100%-24px)] overflow-auto"}>{children}</div>

      {/* Bottom-right corner resize handle */}
      <div
        onPointerDown={handleResizeCorner}
        className="absolute bottom-1 right-1 flex size-5 cursor-nwse-resize items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/tile:opacity-100"
      >
        <svg viewBox="0 0 10 10" className="size-3 text-text/40">
          {/* Updated path for a rounded 16pt-style corner */}
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