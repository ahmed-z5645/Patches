"use client";

import { useRef, useState, useEffect } from "react";
import type { DesktopLayout, MobileLayout } from "@/lib/types/grid";
import type { BlockStyle } from "@/lib/types/blocks";
import { isDarkColor } from "@/lib/constants/colors";

interface BentoTileProps {
  desktopLayout: DesktopLayout;
  mobileLayout: MobileLayout;
  children: React.ReactNode;
  className?: string;
  autoHeight?: boolean;
  withBorder?: boolean;
  blockStyle?: BlockStyle;
}

export function BentoTile({
  desktopLayout,
  children,
  className,
  autoHeight,
  withBorder,
  blockStyle,
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

  const borderless = blockStyle?.borderless;
  const bgColor = blockStyle?.background_color;
  const borderClass = withBorder && !borderless ? "border border-primary" : "";
  const bgClass = bgColor ? "" : "bg-bg";
  const dark = isDarkColor(bgColor);

  return (
    <div
      className={`rounded-[15px] ${bgClass} ${borderClass} ${autoHeight ? "" : "overflow-hidden"} ${className ?? ""}`}
      style={{
        gridColumn: `${desktopLayout.colStart} / span ${desktopLayout.colSpan}`,
        gridRow: `${desktopLayout.rowStart} / span ${effectiveRowSpan}`,
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(dark ? { color: "#eff1f3" } : {}),
      }}
    >
      <div ref={contentRef} className={autoHeight ? "" : "h-full"}>{children}</div>
    </div>
  );
}

export function BentoTileMobile({
  mobileLayout,
  children,
  className,
  withBorder,
  blockStyle,
  autoHeight,
}: {
  mobileLayout: MobileLayout;
  children: React.ReactNode;
  className?: string;
  withBorder?: boolean;
  blockStyle?: BlockStyle;
  autoHeight?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [effectiveRowSpan, setEffectiveRowSpan] = useState(mobileLayout.rowSpan);

  useEffect(() => {
    if (!autoHeight) {
      setEffectiveRowSpan(mobileLayout.rowSpan);
      return;
    }

    const el = contentRef.current;
    if (!el) return;

    function measure() {
      const grid = el!.closest("[data-bento-grid]") as HTMLElement | null;
      if (!grid) return;
      const rowHeight = parseFloat(grid.style.gridAutoRows);
      if (!rowHeight || isNaN(rowHeight)) return;
      const gap = 12;
      const contentHeight = el!.scrollHeight;
      const needed = Math.ceil((contentHeight + gap) / (rowHeight + gap));
      // Never shrink below what the author arranged; only grow to fit so
      // markdown can't be clipped by overflow-hidden after publishing.
      setEffectiveRowSpan(Math.max(needed, mobileLayout.rowSpan));
    }

    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoHeight, mobileLayout.rowSpan]);

  const borderless = blockStyle?.borderless;
  const bgColor = blockStyle?.background_color;
  const borderClass = withBorder && !borderless ? "border border-primary" : "";
  const bgClass = bgColor ? "" : "bg-bg";
  const dark = isDarkColor(bgColor);

  return (
    <div
      className={`rounded-[15px] ${bgClass} ${borderClass} ${autoHeight ? "" : "overflow-hidden"} ${className ?? ""}`}
      style={{
        gridColumn: `${mobileLayout.colStart} / span ${mobileLayout.colSpan}`,
        gridRow: `${mobileLayout.rowStart} / span ${effectiveRowSpan}`,
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(dark ? { color: "#eff1f3" } : {}),
      }}
    >
      <div ref={contentRef} className={autoHeight ? "" : "h-full"}>{children}</div>
    </div>
  );
}
