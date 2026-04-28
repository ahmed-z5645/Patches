"use client";

import { useState, useMemo } from "react";
import type { Block, BlockType } from "@/lib/types/blocks";
import { MobileAddBlockSheet } from "./MobileAddBlockSheet";

interface MobileGhostBlockOverlayProps {
  gridRef: React.RefObject<HTMLDivElement | null>;
  blocks: Block[];
  onAddBlock: (type: BlockType, col: number, row: number) => void;
}

interface EmptyCell {
  col: number;
  row: number;
  rowSpan: number;
}

function isCellOccupied(blocks: Block[], col: number, row: number): boolean {
  for (const b of blocks) {
    if (b.parent_block_id) continue;
    const l = b.grid_layout_mobile;
    if (
      col >= l.colStart &&
      col < l.colStart + l.colSpan &&
      row >= l.rowStart &&
      row < l.rowStart + l.rowSpan
    ) {
      return true;
    }
  }
  return false;
}

export function MobileGhostBlockOverlay({
  blocks,
  onAddBlock,
}: MobileGhostBlockOverlayProps) {
  const [selectedCell, setSelectedCell] = useState<EmptyCell | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  const topLevel = blocks.filter((b) => !b.parent_block_id);

  const emptyCells = useMemo(() => {
    let maxRow = 0;
    for (const b of topLevel) {
      const end = b.grid_layout_mobile.rowStart + b.grid_layout_mobile.rowSpan;
      if (end > maxRow) maxRow = end;
    }
    const scanTo = Math.max(3, maxRow + 2);

    const visited = new Set<string>();
    const cells: EmptyCell[] = [];

    for (let r = 1; r < scanTo; r++) {
      for (let c = 1; c <= 2; c++) {
        const key = `${c},${r}`;
        if (visited.has(key)) continue;
        if (isCellOccupied(topLevel, c, r)) continue;

        let span = 1;
        if (r + 1 < scanTo && !isCellOccupied(topLevel, c, r + 1)) {
          span = 2;
        }

        for (let s = 0; s < span; s++) {
          visited.add(`${c},${r + s}`);
        }
        cells.push({ col: c, row: r, rowSpan: span });
      }
    }
    return cells;
  }, [topLevel]);

  function handleTapPlus(cell: EmptyCell) {
    setSelectedCell(cell);
    setShowSheet(true);
  }

  function handleSelectType(type: BlockType) {
    if (selectedCell) {
      onAddBlock(type, selectedCell.col, selectedCell.row);
      setSelectedCell(null);
      setShowSheet(false);
    }
  }

  return (
    <>
      {emptyCells.map((cell) => (
        <div
          key={`${cell.col}-${cell.row}`}
          style={{
            gridColumn: `${cell.col} / span 1`,
            gridRow: `${cell.row} / span ${cell.rowSpan}`,
          }}
          className="flex items-center justify-center rounded-[15px] border-2 border-dashed border-text/10"
        >
          <button
            onClick={() => handleTapPlus(cell)}
            className="flex size-10 items-center justify-center rounded-full bg-text/5 text-text/25 transition-colors active:bg-text/10 active:text-text/50"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      ))}
      {showSheet && (
        <MobileAddBlockSheet
          onAddBlock={handleSelectType}
          onClose={() => {
            setShowSheet(false);
            setSelectedCell(null);
          }}
        />
      )}
    </>
  );
}
