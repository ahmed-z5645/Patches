"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Block, BlockStyle, Post } from "@/lib/types/blocks";
import { isDarkColor } from "@/lib/constants/colors";
import { MOBILE_HIDDEN_LAYOUT, isMobileHidden, type MobileLayout } from "@/lib/types/grid";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { PostCard } from "@/components/feed/PostCard";
import { COVER_COLORS } from "@/lib/constants/colors";
import { DEFAULT_MOBILE_LAYOUTS } from "./EditorCanvas";

interface PrepublishScreenProps {
  post: Post;
  blocks: Block[];
  username: string;
  onPublish: (coverColor: string, tags: string[]) => void;
  onSaveDraft: () => void;
  onCancel: () => void;
  onMobileLayoutChange: (blockId: string, changes: Partial<MobileLayout>) => void;
}

function PreviewDraggableTile({
  id,
  layout,
  gridMeta,
  onResize,
  onRemove,
  children,
  autoHeight,
  blockStyle,
}: {
  id: string;
  layout: MobileLayout;
  gridMeta: { colWidth: number; rowHeight: number };
  onResize: (id: string, changes: Partial<MobileLayout>) => void;
  onRemove: (id: string) => void;
  children: React.ReactNode;
  autoHeight?: boolean;
  blockStyle?: BlockStyle;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, data: { from: "phone" } });
  const contentRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const grownRowSpanRef = useRef(layout.rowSpan);

  useEffect(() => {
    if (!autoHeight) return;
    const el = contentRef.current;
    if (!el) return;
    let raf: number | null = null;

    function measure() {
      raf = null;
      if (isResizingRef.current) return;
      const grid = el!.closest("[data-preview-grid]") as HTMLElement | null;
      if (!grid) return;
      const rowHeight = parseFloat(grid.style.gridAutoRows);
      if (!rowHeight || isNaN(rowHeight)) return;
      const gap = 12;
      const dragHandleHeight = 16;
      const scaledContentHeight = el!.scrollHeight * 0.7;
      const needed = Math.ceil(
        (scaledContentHeight + dragHandleHeight + gap) / (rowHeight + gap)
      );
      if (layout.rowSpan > grownRowSpanRef.current) {
        grownRowSpanRef.current = layout.rowSpan;
      }
      const target = Math.max(needed, layout.rowSpan);
      if (target > grownRowSpanRef.current) {
        grownRowSpanRef.current = target;
        onResize(id, { rowSpan: target });
      }
    }

    function schedule() {
      if (raf != null) return;
      raf = requestAnimationFrame(measure);
    }

    schedule();
    const obs = new ResizeObserver(schedule);
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [autoHeight, id, layout.rowSpan, onResize]);

  const handleResizeCorner = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      setIsResizing(true);
      isResizingRef.current = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const startColSpan = layout.colSpan;
      const startRowSpan = layout.rowSpan;
      let lastColSpan = startColSpan;
      let lastRowSpan = startRowSpan;
      const gap = 12;

      // Minimum rows needed to show the block's content without clipping.
      // Content is rendered at scale(0.7) inside the tile, plus a 16px drag handle.
      const dragHandleHeight = 16;
      const contentEl = contentRef.current;
      const minRowSpan = contentEl && gridMeta.rowHeight
        ? Math.max(
            1,
            Math.ceil(
              (contentEl.scrollHeight * 0.7 + dragHandleHeight + gap) /
                (gridMeta.rowHeight + gap)
            )
          )
        : 1;

      function onMove(ev: PointerEvent) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const colDelta = Math.round(dx / (gridMeta.colWidth + gap));
        const rowDelta = Math.round(dy / (gridMeta.rowHeight + gap));
        const newColSpan = Math.max(1, Math.min(3 - layout.colStart, startColSpan + colDelta));
        const newRowSpan = Math.max(minRowSpan, startRowSpan + rowDelta);
        if (newColSpan !== lastColSpan || newRowSpan !== lastRowSpan) {
          lastColSpan = newColSpan;
          lastRowSpan = newRowSpan;
          onResize(id, { colSpan: newColSpan, rowSpan: newRowSpan });
        }
      }

      function onUp() {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        setIsResizing(false);
        isResizingRef.current = false;
        grownRowSpanRef.current = lastRowSpan;
      }

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
    },
    [id, layout, gridMeta, onResize]
  );

  const handleRemovePointerDown = useCallback((e: React.PointerEvent) => {
    // Whole tile is a drag handle — stop the gesture so dnd-kit doesn't claim it.
    e.stopPropagation();
  }, []);

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(id);
    },
    [id, onRemove]
  );

  const borderless = blockStyle?.borderless;
  const bgColor = blockStyle?.background_color;
  const dark = isDarkColor(bgColor);
  const active = isDragging || isResizing;
  const style = {
    gridColumn: `${layout.colStart} / span ${layout.colSpan}`,
    gridRow: `${layout.rowStart} / span ${layout.rowSpan}`,
    x: transform?.x ?? 0,
    y: transform?.y ?? 0,
    zIndex: active ? 50 : undefined,
    touchAction: "none" as const,
    ...(bgColor ? { backgroundColor: bgColor } : {}),
    ...(dark ? { color: "#eff1f3" } : {}),
  };
  const tileBgClass = bgColor ? "" : "bg-bg";
  const tileBorderClass = borderless ? "" : "border border-primary/50";
  const handleBorderClass = borderless ? "" : "border-b border-primary/20";

  return (
    <motion.div
      ref={setNodeRef}
      layout={!active}
      style={style}
      {...listeners}
      {...attributes}
      animate={{ opacity: isDragging ? 0.7 : 1, scale: isDragging ? 1.03 : 1 }}
      transition={{ duration: 0.15, x: { duration: 0 }, y: { duration: 0 }, scale: { type: "spring", stiffness: 300, damping: 15 }, layout: { type: "spring", stiffness: 200, damping: 18, mass: 1.2 } }}
      className={`group/tile relative cursor-grab active:cursor-grabbing ${autoHeight ? "" : "overflow-hidden"} rounded-[8px] ${tileBorderClass} ${tileBgClass}`}
    >
      <div
        className={`flex h-4 items-center justify-center ${handleBorderClass}`}
      >
        <div className="flex gap-px">
          <span className="size-[3px] rounded-full bg-text/20" />
          <span className="size-[3px] rounded-full bg-text/20" />
          <span className="size-[3px] rounded-full bg-text/20" />
        </div>
      </div>
      <div ref={contentRef} className={autoHeight ? "" : "h-[calc(100%-16px)] overflow-hidden"}>{children}</div>
      <button
        type="button"
        onPointerDown={handleRemovePointerDown}
        onClick={handleRemoveClick}
        aria-label="Remove from mobile layout"
        className="absolute right-1 top-1 z-10 flex size-4 items-center justify-center rounded-full bg-text/70 text-bg opacity-0 transition-opacity group-hover/tile:opacity-100"
      >
        <svg viewBox="0 0 10 10" className="size-2">
          <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div
        onPointerDown={handleResizeCorner}
        className="absolute bottom-0 right-0 flex size-7 cursor-nwse-resize items-end justify-end p-1"
      >
        <svg viewBox="0 0 10 10" className="size-2.5 text-text/40">
          <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </motion.div>
  );
}

function PaletteItem({ block }: { block: Block }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: block.id, data: { from: "palette", type: block.type } });
  const style = {
    x: transform?.x ?? 0,
    y: transform?.y ?? 0,
    zIndex: isDragging ? 50 : undefined,
    touchAction: "none" as const,
  };
  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      animate={{ opacity: isDragging ? 0.7 : 1, scale: isDragging ? 1.03 : 1 }}
      transition={{ duration: 0.15, x: { duration: 0 }, y: { duration: 0 } }}
      className="group/palette cursor-grab overflow-hidden rounded-[10px] border border-primary/50 bg-bg active:cursor-grabbing"
    >
      <div className="flex items-center justify-between border-b border-primary/20 px-2 py-1">
        <span className="text-[10px] uppercase tracking-wide text-text/60">{block.type}</span>
        <span className="text-[10px] text-text/30">drag</span>
      </div>
      <div className="pointer-events-none h-[90px] overflow-hidden">
        <div style={{ width: "200%", height: "200%", transform: "scale(0.5)", transformOrigin: "top left" }}>
          <BlockRenderer block={block} />
        </div>
      </div>
    </motion.div>
  );
}

function PhonePreview({
  title,
  placed,
  gridRef,
  gridMeta,
  onLayoutChange,
  onRemove,
}: {
  title: string;
  placed: Block[];
  gridRef: React.RefObject<HTMLDivElement | null>;
  gridMeta: { colWidth: number; rowHeight: number };
  onLayoutChange: (id: string, changes: Partial<MobileLayout>) => void;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "phone" });

  return (
    <div
      className="rounded-[40px] border-[5px] border-text/80 bg-bg"
      style={{ aspectRatio: "393 / 852" }}
    >
      <div className="flex h-full flex-col px-3 pt-2 pb-3">
        <div className="mx-auto mb-2 h-4 w-20 rounded-full bg-text/80" />

        <div className="mb-2 flex items-center gap-2 px-1">
          <svg width="12" height="12" viewBox="0 0 12 12" className="text-text/60">
            <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
          <span className="text-[10px] text-text/60">page name hereee</span>
        </div>

        <div ref={setNodeRef} className={`flex-1 overflow-y-auto rounded-[12px] px-1 transition-colors ${isOver ? "bg-accent/10" : ""}`}>
          <h2 className="mb-1 font-[family-name:var(--font-cabinet)] text-base font-bold leading-tight">
            {title || "Untitled"}
          </h2>
          <p className="mb-3 text-[8px] text-text/40">
            META DATA LIKE AUTHOR AND PUBLISH DATE AND EST READING TIME AND SUCH
          </p>

          <div
            ref={gridRef}
            data-preview-grid
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gridAutoRows: gridMeta.rowHeight || 60,
              gap: 12,
              minHeight: placed.length === 0 ? 200 : undefined,
            }}
          >
            {placed.length === 0 && (
              <div className="col-span-2 flex h-[200px] items-center justify-center rounded-[12px] border border-dashed border-text/20">
                <p className="text-center text-[10px] text-text/40">
                  drag blocks here<br />to place them on mobile
                </p>
              </div>
            )}
            {placed.map((block) => (
              <PreviewDraggableTile
                key={block.id}
                id={block.id}
                layout={block.grid_layout_mobile}
                gridMeta={gridMeta}
                onResize={onLayoutChange}
                onRemove={onRemove}
                autoHeight={block.type === "markdown"}
                blockStyle={block.style}
              >
                <div className="pointer-events-none h-full overflow-hidden">
                  <div style={{ width: "142.86%", height: "142.86%", transform: "scale(0.7)", transformOrigin: "top left" }}>
                    <BlockRenderer block={block} />
                  </div>
                </div>
              </PreviewDraggableTile>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-around border-t border-primary/30 pt-2">
          <svg width="16" height="16" viewBox="0 0 24 24" className="text-text/40 rotate-45">
            <path d="M12 2a8 8 0 018 8c0 5-8 14-8 14S4 15 4 10a8 8 0 018-8z" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <svg width="16" height="16" viewBox="0 0 24 24" className="text-text/40">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <svg width="16" height="16" viewBox="0 0 24 24" className="text-text/40">
            <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M4 20c0-4 4-7 8-7s8 3 8 7" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="mx-auto mt-1 h-1 w-20 rounded-full bg-text/20" />
      </div>
    </div>
  );
}

export function PrepublishScreen({
  post,
  blocks,
  username,
  onPublish,
  onSaveDraft,
  onCancel,
  onMobileLayoutChange,
}: PrepublishScreenProps) {
  const [visible, setVisible] = useState(false);
  const [coverColor, setCoverColor] = useState(post.cover_color || COVER_COLORS[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridMeta, setGridMeta] = useState({ colWidth: 0, rowHeight: 0 });
  const didResetRef = useRef(false);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(touchSensor, pointerSensor);

  useEffect(() => {
    setVisible(true);
  }, []);

  // Reset every top-level block to "unplaced" exactly once on mount so the
  // phone starts empty and the palette shows every block.
  useEffect(() => {
    if (didResetRef.current) return;
    didResetRef.current = true;
    for (const b of blocks) {
      if (b.parent_block_id) continue;
      if (!isMobileHidden(b.grid_layout_mobile)) {
        onMobileLayoutChange(b.id, MOBILE_HIDDEN_LAYOUT);
      }
    }
  }, [blocks, onMobileLayoutChange]);

  useEffect(() => {
    function update() {
      if (!gridRef.current) return;
      const w = gridRef.current.clientWidth;
      const gap = 12;
      const colWidth = (w - gap) / 2;
      setGridMeta({ colWidth, rowHeight: colWidth / 2 });
    }
    update();
    const obs = new ResizeObserver(update);
    if (gridRef.current) obs.observe(gridRef.current);
    return () => obs.disconnect();
  }, [visible]);

  const topLevel = useMemo(() => blocks.filter((b) => !b.parent_block_id), [blocks]);
  const palette = useMemo(
    () => topLevel.filter((b) => isMobileHidden(b.grid_layout_mobile)),
    [topLevel]
  );
  const placed = useMemo(
    () => topLevel.filter((b) => !isMobileHidden(b.grid_layout_mobile)),
    [topLevel]
  );

  function findEmptyCell(): { colStart: number; rowStart: number } {
    // First-fit scan, columns left-to-right within each row.
    for (let r = 1; r <= 100; r++) {
      for (let c = 1; c <= 2; c++) {
        const occupied = placed.some((b) => {
          const l = b.grid_layout_mobile;
          return (
            c >= l.colStart &&
            c < l.colStart + l.colSpan &&
            r >= l.rowStart &&
            r < l.rowStart + l.rowSpan
          );
        });
        if (!occupied) return { colStart: c, rowStart: r };
      }
    }
    return { colStart: 1, rowStart: 1 };
  }

  function snapToCell(clientX: number, clientY: number): { colStart: number; rowStart: number } | null {
    if (!gridRef.current || !gridMeta.colWidth || !gridMeta.rowHeight) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const gap = 12;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const colStart = Math.max(1, Math.min(2, Math.floor(relX / (gridMeta.colWidth + gap)) + 1));
    const rowStart = Math.max(1, Math.floor(relY / (gridMeta.rowHeight + gap)) + 1);
    return { colStart, rowStart };
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over, delta, activatorEvent } = event;
    const blockId = active.id as string;
    const from = (active.data.current as { from?: string } | undefined)?.from;

    if (from === "palette") {
      if (over?.id !== "phone") return;
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const defaults =
        DEFAULT_MOBILE_LAYOUTS[block.type] || { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 };

      // Snap to the cell under the pointer when we can read it; otherwise
      // fall back to the next empty cell.
      let placement: { colStart: number; rowStart: number } | null = null;
      const e = activatorEvent as PointerEvent | TouchEvent | MouseEvent;
      let startX: number | null = null;
      let startY: number | null = null;
      if (e && "clientX" in e && typeof e.clientX === "number") {
        startX = e.clientX;
        startY = (e as PointerEvent).clientY;
      } else if (e && "touches" in e && e.touches?.[0]) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
      if (startX != null && startY != null) {
        placement = snapToCell(startX + delta.x, startY + delta.y);
      }
      if (!placement) placement = findEmptyCell();

      const colSpan = Math.min(defaults.colSpan, 3 - placement.colStart);
      onMobileLayoutChange(blockId, {
        colStart: placement.colStart,
        rowStart: placement.rowStart,
        colSpan: Math.max(1, colSpan),
        rowSpan: defaults.rowSpan,
      });
      return;
    }

    // from === "phone" — move within the phone grid (existing snap logic).
    if (!gridMeta.colWidth || !gridMeta.rowHeight) return;
    const block = topLevel.find((b) => b.id === blockId);
    if (!block) return;
    const layout = block.grid_layout_mobile;
    const gap = 12;
    const colDelta = Math.round(delta.x / (gridMeta.colWidth + gap));
    const rowDelta = Math.round(delta.y / (gridMeta.rowHeight + gap));
    if (colDelta === 0 && rowDelta === 0) return;
    const newColStart = Math.max(1, Math.min(3 - layout.colSpan, layout.colStart + colDelta));
    const newRowStart = Math.max(1, layout.rowStart + rowDelta);
    onMobileLayoutChange(blockId, { colStart: newColStart, rowStart: newRowStart });
  }

  function handleRemove(id: string) {
    onMobileLayoutChange(id, MOBILE_HIDDEN_LAYOUT);
  }

  function handleCancel() {
    setVisible(false);
    setTimeout(onCancel, 300);
  }

  function handlePublish() {
    setVisible(false);
    setTimeout(() => onPublish(coverColor, tags), 300);
  }

  function handleAddTag() {
    const value = tagInput.trim().toLowerCase();
    if (value && tags.length < 3 && !tags.includes(value)) {
      setTags((prev) => [...prev, value]);
      setTagInput("");
    }
  }

  function handleSaveDraft() {
    setVisible(false);
    setTimeout(onSaveDraft, 300);
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-text/30"
            onClick={handleCancel}
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg"
          >
            <div className="flex flex-1 items-start justify-center px-10 py-10">
              <div className="flex flex-col">
                <button
                  onClick={handleCancel}
                  className="mb-6 flex items-center gap-1 self-start text-sm text-text/60 hover:text-text"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                  back to editor
                </button>

                <h1 className="mb-2 font-[family-name:var(--font-cabinet)] text-3xl font-bold">
                  Ready to publish?
                </h1>
                <p className="mb-8 max-w-2xl text-sm text-text/70">
                  Drag blocks from the palette on the left into the phone to arrange your mobile layout. Anything left in the palette will be hidden on mobile (still visible on desktop). Then pick your tags and cover.
                </p>

                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  <div className="flex items-start gap-8">
                    <div className="flex w-[200px] shrink-0 flex-col">
                      <h2 className="mb-3 font-[family-name:var(--font-cabinet)] text-sm font-bold uppercase tracking-wide text-text/60">
                        Blocks ({palette.length})
                      </h2>
                      <div className="flex flex-col gap-2 rounded-[15px] border border-primary/30 bg-text/[0.02] p-2" style={{ minHeight: 200 }}>
                        {palette.length === 0 ? (
                          <p className="px-2 py-6 text-center text-xs text-text/40">
                            all blocks placed
                          </p>
                        ) : (
                          palette.map((block) => <PaletteItem key={block.id} block={block} />)
                        )}
                      </div>
                    </div>

                    <div className="w-[280px] shrink-0">
                      <PhonePreview
                        title={post.title || ""}
                        placed={placed}
                        gridRef={gridRef}
                        gridMeta={gridMeta}
                        onLayoutChange={onMobileLayoutChange}
                        onRemove={handleRemove}
                      />
                    </div>

                    <div className="flex w-[360px] shrink-0 flex-col">
                      <h2 className="mb-3 font-[family-name:var(--font-cabinet)] text-xl font-bold">
                        Add tags:
                      </h2>
                      <div className="mb-8 flex flex-wrap content-start items-start gap-2 rounded-[15px] border border-primary/40 p-5" style={{ minHeight: 80 }}>
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-text/10 px-3 py-1.5 text-sm"
                          >
                            #{tag}
                            <button
                              onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                              className="ml-0.5 text-text/40 hover:text-text"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                        {tags.length < 3 && (
                          <input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTag();
                              }
                            }}
                            placeholder={tags.length === 0 ? "e.g. travel, cooking..." : "add another..."}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text/30"
                          />
                        )}
                      </div>

                      <h2 className="mb-3 font-[family-name:var(--font-cabinet)] text-xl font-bold">
                        Choose a cover:
                      </h2>

                      <div className="pointer-events-none mb-4">
                        <PostCard
                          compact
                          post={{
                            ...post,
                            cover_color: coverColor,
                            blocks: blocks,
                            profiles: username
                              ? { username, display_name: null, avatar_url: null }
                              : undefined,
                          }}
                        />
                      </div>

                      <div className="mb-10 flex flex-wrap justify-center gap-3">
                        {COVER_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setCoverColor(color)}
                            className={`size-7 rounded-full transition-all ${
                              coverColor === color
                                ? "ring-2 ring-accent ring-offset-2 ring-offset-bg"
                                : "hover:scale-110"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={handleSaveDraft}
                          className="flex-1 rounded-[15px] border border-primary py-3 text-sm hover:border-text"
                        >
                          save as draft
                        </button>
                        <button
                          onClick={handlePublish}
                          className="flex-1 rounded-[15px] bg-text py-3 text-sm font-bold text-bg hover:bg-text/90"
                        >
                          PUBLISH
                        </button>
                      </div>
                    </div>
                  </div>
                </DndContext>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
