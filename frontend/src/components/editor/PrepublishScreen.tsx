"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Block, BlockStyle, Post } from "@/lib/types/blocks";
import { isDarkColor } from "@/lib/constants/colors";
import type { MobileLayout } from "@/lib/types/grid";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { PostCard } from "@/components/feed/PostCard";
import { COVER_COLORS } from "@/lib/constants/colors";

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
  children,
  autoHeight,
  blockStyle,
}: {
  id: string;
  layout: MobileLayout;
  gridMeta: { colWidth: number; rowHeight: number };
  onResize: (id: string, changes: Partial<MobileLayout>) => void;
  children: React.ReactNode;
  autoHeight?: boolean;
  blockStyle?: BlockStyle;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });
  const contentRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  // Highest rowSpan auto-grow has already requested. Keeping this monotonic
  // stops the ResizeObserver -> onResize -> re-render -> ResizeObserver loop
  // that previously thrashed the grid and froze drag/resize.
  const grownRowSpanRef = useRef(layout.rowSpan);

  useEffect(() => {
    if (!autoHeight) return;
    const el = contentRef.current;
    if (!el) return;
    let raf: number | null = null;

    function measure() {
      raf = null;
      // Don't fight the user while they're hand-resizing this tile.
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
      // Honor a manual enlarge so we don't immediately fight it back down.
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

      function onMove(ev: PointerEvent) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const colDelta = Math.round(dx / (gridMeta.colWidth + gap));
        const rowDelta = Math.round(dy / (gridMeta.rowHeight + gap));
        const newColSpan = Math.max(1, Math.min(3 - layout.colStart, startColSpan + colDelta));
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
        setIsResizing(false);
        isResizingRef.current = false;
        // Let auto-grow re-evaluate from the user's chosen size.
        grownRowSpanRef.current = lastRowSpan;
      }

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
    },
    [id, layout, gridMeta, onResize]
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
    // Bring the tile being interacted with to the front so it (and its resize
    // corner) is never trapped under an overlapping tile.
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
      // Disable the layout spring during direct manipulation so it can't
      // fight the pointer or strand the tile mid-animation.
      layout={!active}
      style={style}
      // The whole tile is the drag handle — overlap no longer means the only
      // grab target (a 16px strip) is buried under another tile.
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

function MobilePhonePreview({
  title,
  blocks,
  onLayoutChange,
}: {
  title: string;
  blocks: Block[];
  onLayoutChange: (id: string, changes: Partial<MobileLayout>) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridMeta, setGridMeta] = useState({ colWidth: 0, rowHeight: 0 });
  const topLevel = blocks.filter((b) => !b.parent_block_id);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(touchSensor, pointerSensor);

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
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    if (!gridMeta.colWidth || !gridMeta.rowHeight) return;
    const blockId = active.id as string;
    const block = topLevel.find((b) => b.id === blockId);
    if (!block) return;
    const layout = block.grid_layout_mobile;

    const gap = 12;
    const colDelta = Math.round(delta.x / (gridMeta.colWidth + gap));
    const rowDelta = Math.round(delta.y / (gridMeta.rowHeight + gap));
    if (colDelta === 0 && rowDelta === 0) return;

    const newColStart = Math.max(1, Math.min(3 - layout.colSpan, layout.colStart + colDelta));
    const newRowStart = Math.max(1, layout.rowStart + rowDelta);
    onLayoutChange(blockId, { colStart: newColStart, rowStart: newRowStart });
  }

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

        <div className="flex-1 overflow-y-auto px-1">
          <h2 className="mb-1 font-[family-name:var(--font-cabinet)] text-base font-bold leading-tight">
            {title || "Untitled"}
          </h2>
          <p className="mb-3 text-[8px] text-text/40">
            META DATA LIKE AUTHOR AND PUBLISH DATE AND EST READING TIME AND SUCH
          </p>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div
              ref={gridRef}
              data-preview-grid
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gridAutoRows: gridMeta.rowHeight || "auto",
                gap: 12,
              }}
            >
              {topLevel.map((block) => (
                <PreviewDraggableTile
                  key={block.id}
                  id={block.id}
                  layout={block.grid_layout_mobile}
                  gridMeta={gridMeta}
                  onResize={onLayoutChange}
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
          </DndContext>
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

  useEffect(() => {
    setVisible(true);
  }, []);

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
            className="fixed inset-0 z-50 flex flex-col bg-bg"
          >
            <div className="flex flex-1 items-center justify-center px-10">
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

                <div className="flex items-start gap-16">
                  <div className="flex w-[380px] flex-col">
                    <h1 className="mb-3 font-[family-name:var(--font-cabinet)] text-3xl font-bold">
                      Ready to publish?
                    </h1>

                    <ul className="mb-8 space-y-1 text-sm text-text/70">
                      <li className="flex items-start gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-text/40" />
                        Scroll through how this might look on your phone
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-text/40" />
                        Components can be resized, replaced, or deleted for mobile view!
                      </li>
                    </ul>

                    <h2 className="mb-3 font-[family-name:var(--font-cabinet)] text-xl font-bold">
                      Add tags:
                    </h2>
                    <div className="mb-8 flex flex-wrap content-start items-start gap-2 rounded-[15px] border border-primary/40 p-5" style={{ height: 80 }}>
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

                    <div className="mb-4 pointer-events-none">
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

                    <div className="mb-10 flex justify-center gap-3">
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

                  <div className="w-[280px] shrink-0">
                    <MobilePhonePreview
                      title={post.title || ""}
                      blocks={blocks}
                      onLayoutChange={onMobileLayoutChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
