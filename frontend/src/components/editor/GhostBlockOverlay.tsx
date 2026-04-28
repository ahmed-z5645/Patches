"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Block, BlockType } from "@/lib/types/blocks";

interface GhostBlockOverlayProps {
  gridRef: React.RefObject<HTMLDivElement | null>;
  blocks: Block[];
  onAddBlock: (type: BlockType, col: number, row: number) => void;
}

interface GhostCell {
  col: number;
  row: number;
  rowSpan: number;
}

const QUICK_TYPES: { type: BlockType; label: string; icon: React.ReactNode }[] =
  [
    {
      type: "markdown",
      label: "Text",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 6.1H3" />
          <path d="M21 12.1H3" />
          <path d="M15.1 18H3" />
        </svg>
      ),
    },
    {
      type: "image",
      label: "Image",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      ),
    },
    {
      type: "quote",
      label: "Quote",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
        </svg>
      ),
    },
  ];

const ALL_TYPES: { type: BlockType; label: string }[] = [
  { type: "markdown", label: "Text" },
  { type: "image", label: "Image" },
  { type: "quote", label: "Quote" },
  { type: "code", label: "Code" },
  { type: "spotify", label: "Spotify" },
  { type: "strava", label: "Strava" },
  { type: "map", label: "Map" },
  { type: "weather", label: "Weather" },
];

function isCellOccupied(blocks: Block[], col: number, row: number): boolean {
  for (const b of blocks) {
    if (b.parent_block_id) continue;
    const l = b.grid_layout_desktop;
    const colEnd = l.colStart + l.colSpan;
    const rowEnd = l.rowStart + l.rowSpan;
    if (col >= l.colStart && col < colEnd && row >= l.rowStart && row < rowEnd) {
      return true;
    }
  }
  return false;
}

function findGhostPlacement(
  blocks: Block[],
  col: number,
  row: number
): { startRow: number; rowSpan: number } | null {
  if (isCellOccupied(blocks, col, row)) return null;

  let span = 1;
  if (!isCellOccupied(blocks, col, row + 1)) {
    span = 2;
  }
  return { startRow: row, rowSpan: span };
}

export function GhostBlockOverlay({
  gridRef,
  blocks,
  onAddBlock,
}: GhostBlockOverlayProps) {
  const [ghost, setGhost] = useState<GhostCell | null>(null);
  const [activeGhost, setActiveGhost] = useState<GhostCell | null>(null);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getGridMetrics = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const gap = 16;
    const colWidth = (rect.width - gap * 3) / 4;
    const rowHeight = colWidth / 2;
    return { rect, gap, colWidth, rowHeight };
  }, [gridRef]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (activeGhost) return;

      const metrics = getGridMetrics();
      if (!metrics) return;
      const { rect, gap, colWidth, rowHeight } = metrics;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x < 0 || y < 0 || x > rect.width) {
        setGhost(null);
        return;
      }

      const col = Math.min(4, Math.max(1, Math.floor(x / (colWidth + gap)) + 1));
      const row = Math.max(1, Math.floor(y / (rowHeight + gap)) + 1);

      const result = findGhostPlacement(blocks, col, row);
      if (!result) {
        setGhost(null);
        return;
      }

      setGhost({ col, row: result.startRow, rowSpan: result.rowSpan });
    },
    [blocks, getGridMetrics, activeGhost]
  );

  const handleMouseLeave = useCallback(() => {
    if (!activeGhost) {
      setGhost(null);
    }
  }, [activeGhost]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.addEventListener("mousemove", handleMouseMove);
    grid.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      grid.removeEventListener("mousemove", handleMouseMove);
      grid.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [gridRef, handleMouseMove, handleMouseLeave]);

  useEffect(() => {
    if (!activeGhost) return;
    function handleClickOutside(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setActiveGhost(null);
        setShowAllTypes(false);
        setGhost(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeGhost]);

  function handlePlusClick() {
    if (ghost) {
      setActiveGhost(ghost);
      setShowAllTypes(false);
    }
  }

  function handleSelectType(type: BlockType) {
    if (activeGhost) {
      onAddBlock(type, activeGhost.col, activeGhost.row);
      setActiveGhost(null);
      setShowAllTypes(false);
      setGhost(null);
    }
  }

  const target = activeGhost || ghost;
  if (!target) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        gridColumn: `${target.col} / span 1`,
        gridRow: `${target.row} / span ${target.rowSpan}`,
        pointerEvents: activeGhost ? "auto" : "none",
      }}
      className="relative z-10 flex items-center justify-center rounded-[15px] border-2 border-dashed border-text/15 transition-colors"
    >
      {!activeGhost ? (
        <button
          onClick={handlePlusClick}
          style={{ pointerEvents: "auto" }}
          className="flex size-10 items-center justify-center rounded-full bg-text/5 text-text/30 transition-colors hover:bg-text/10 hover:text-text/50"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      ) : !showAllTypes ? (
        <div className="flex items-center gap-2">
          {QUICK_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => handleSelectType(type)}
              title={label}
              className="flex size-10 items-center justify-center rounded-[10px] text-text/40 transition-colors hover:bg-text/10 hover:text-text/70"
            >
              {icon}
            </button>
          ))}
          <button
            onClick={() => setShowAllTypes(true)}
            title="More blocks"
            className="flex size-10 items-center justify-center rounded-[10px] text-text/40 transition-colors hover:bg-text/10 hover:text-text/70"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex max-h-full flex-col gap-1 overflow-y-auto rounded-[10px] bg-bg p-2 shadow-lg ring-1 ring-primary">
          {ALL_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleSelectType(type)}
              className="rounded-[8px] px-4 py-1.5 text-left text-sm text-text/60 transition-colors hover:bg-text/5 hover:text-text"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
