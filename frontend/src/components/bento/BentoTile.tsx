"use client";

import { useRef, useState, useEffect } from "react";
import type { DesktopLayout, MobileLayout } from "@/lib/types/grid";

interface BentoTileProps {
  desktopLayout: DesktopLayout;
  mobileLayout: MobileLayout;
  children: React.ReactNode;
  className?: string;
  autoHeight?: boolean;
}

export function BentoTile({
  desktopLayout,
  children,
  className,
  autoHeight,
}: BentoTileProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [effectiveRowSpan, setEffectiveRowSpan] = useState(desktopLayout.rowSpan);

  useEffect(() => {
    if (!autoHeight) {
      setEffectiveRowSpan(desktopLayout.rowSpan);
      return;
    }

    const el = contentRef.current;
    if (!el) return;

    function measure() {
      const grid = el!.closest("[data-bento-grid]") as HTMLElement | null;
      if (!grid) return;
      const rowHeight = parseFloat(grid.style.gridAutoRows);
      if (!rowHeight || isNaN(rowHeight)) return;
      const gap = 16;
      const contentHeight = el!.scrollHeight;
      const needed = Math.ceil((contentHeight + gap) / (rowHeight + gap));
      const rounded = Math.max(needed, desktopLayout.rowSpan);
      setEffectiveRowSpan(rounded);
    }

    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoHeight, desktopLayout.rowSpan]);

  return (
    <div
      className={`rounded-[15px] bg-bg ${autoHeight ? "" : "overflow-hidden"} ${className ?? ""}`}
      style={{
        gridColumn: `${desktopLayout.colStart} / span ${desktopLayout.colSpan}`,
        gridRow: `${desktopLayout.rowStart} / span ${effectiveRowSpan}`,
      }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

export function BentoTileMobile({
  mobileLayout,
  children,
  className,
}: {
  mobileLayout: MobileLayout;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[15px] bg-bg ${className ?? ""}`}
      style={{
        gridColumn: `${mobileLayout.colStart} / span ${mobileLayout.colSpan}`,
        gridRow: `${mobileLayout.rowStart} / span ${mobileLayout.rowSpan}`,
      }}
    >
      {children}
    </div>
  );
}
