"use client";

import { forwardRef, useRef, useEffect, useState, useImperativeHandle, useMemo } from "react";

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
  minExtraRows?: number;
  blocks?: { grid_layout_desktop: { rowStart: number; rowSpan: number } }[];
}

export const BentoGrid = forwardRef<HTMLDivElement, BentoGridProps>(
  function BentoGrid({ children, className, minExtraRows, blocks }, ref) {
    const gridRef = useRef<HTMLDivElement>(null);
    const [rowHeight, setRowHeight] = useState(0);

    useImperativeHandle(ref, () => gridRef.current!);

    useEffect(() => {
      function updateRowHeight() {
        if (!gridRef.current) return;
        const gridWidth = gridRef.current.clientWidth;
        const gap = 16;
        const colWidth = (gridWidth - gap * 3) / 4;
        setRowHeight(colWidth / 2);
      }

      updateRowHeight();
      const observer = new ResizeObserver(updateRowHeight);
      if (gridRef.current) observer.observe(gridRef.current);
      return () => observer.disconnect();
    }, []);

    const totalRows = useMemo(() => {
      if (!blocks) return 0;
      let maxRow = 0;
      for (const b of blocks) {
        const end = b.grid_layout_desktop.rowStart + b.grid_layout_desktop.rowSpan;
        if (end > maxRow) maxRow = end;
      }
      return maxRow - 1 + (minExtraRows || 0);
    }, [blocks, minExtraRows]);

    const minHeight = useMemo(() => {
      if (!totalRows || !rowHeight) return undefined;
      const gap = 16;
      return totalRows * rowHeight + (totalRows - 1) * gap;
    }, [totalRows, rowHeight]);

    return (
      <div
        ref={gridRef}
        className={className}
        data-bento-grid
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridAutoRows: rowHeight || "auto",
          gap: 16,
          minHeight,
        }}
      >
        {children}
      </div>
    );
  }
);

interface MobileGridProps {
  children: React.ReactNode;
  className?: string;
  minExtraRows?: number;
  blocks?: { grid_layout_mobile: { rowStart: number; rowSpan: number } }[];
}

export const BentoGridMobile = forwardRef<HTMLDivElement, MobileGridProps>(
  function BentoGridMobile({ children, className, minExtraRows, blocks }, ref) {
    const gridRef = useRef<HTMLDivElement>(null);
    const [rowHeight, setRowHeight] = useState(0);

    useImperativeHandle(ref, () => gridRef.current!);

    useEffect(() => {
      function updateRowHeight() {
        if (!gridRef.current) return;
        const gridWidth = gridRef.current.clientWidth;
        const gap = 12;
        const colWidth = (gridWidth - gap) / 2;
        setRowHeight(colWidth / 2);
      }

      updateRowHeight();
      const observer = new ResizeObserver(updateRowHeight);
      if (gridRef.current) observer.observe(gridRef.current);
      return () => observer.disconnect();
    }, []);

    const totalRows = useMemo(() => {
      if (!blocks) return 0;
      let maxRow = 0;
      for (const b of blocks) {
        const end = b.grid_layout_mobile.rowStart + b.grid_layout_mobile.rowSpan;
        if (end > maxRow) maxRow = end;
      }
      return maxRow - 1 + (minExtraRows || 0);
    }, [blocks, minExtraRows]);

    const minHeight = useMemo(() => {
      if (!totalRows || !rowHeight) return undefined;
      const gap = 12;
      return totalRows * rowHeight + (totalRows - 1) * gap;
    }, [totalRows, rowHeight]);

    return (
      <div
        ref={gridRef}
        className={className}
        data-bento-grid
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gridAutoRows: rowHeight || "auto",
          gap: 12,
          minHeight,
        }}
      >
        {children}
      </div>
    );
  }
);
