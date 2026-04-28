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
import type { Block, Post } from "@/lib/types/blocks";
import type { MobileLayout } from "@/lib/types/grid";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { PostCard } from "@/components/feed/PostCard";

interface PrepublishScreenProps {
  post: Post;
  blocks: Block[];
  username: string;
  onPublish: (coverColor: string, tags: string[]) => void;
  onSaveDraft: () => void;
  onCancel: () => void;
  onMobileLayoutChange: (blockId: string, changes: Partial<MobileLayout>) => void;
}

const COVER_COLORS = [
  "#223843",
  "#fb5012",
  "#d8b4a0",
  "#dbd3d8",
  "#4a7c59",
  "#6b5b95",
  "#e8a87c",
  "#41b3a3",
  "#c38d9e",
  "#659dbd",
];

function PreviewDraggableTile({
  id,
  layout,
  gridMeta,
  onResize,
  children,
  autoHeight,
}: {
  id: string;
  layout: MobileLayout;
  gridMeta: { colWidth: number; rowHeight: number };
  onResize: (id: string, changes: Partial<MobileLayout>) => void;
  children: React.ReactNode;
  autoHeight?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoHeight) return;
    const el = contentRef.current;
    if (!el) return;

    function measure() {
      const grid = el!.closest("[data-preview-grid]") as HTMLElement | null;
      if (!grid) return;
      const rowHeight = parseFloat(grid.style.gridAutoRows);
      if (!rowHeight || isNaN(rowHeight)) return;
      const gap = 12;
      const dragHandleHeight = 16;
      const scaledContentHeight = el!.scrollHeight * 0.7;
      const needed = Math.ceil((scaledContentHeight + dragHandleHeight + gap) / (rowHeight + gap));
      if (needed !== layout.rowSpan) {
        onResize(id, { rowSpan: needed });
      }
    }

    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoHeight, id, layout.rowSpan, onResize]);

  const handleResizeCorner = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const startColSpan = layout.colSpan;
      const startRowSpan = layout.rowSpan;
      const gap = 12;

      function onMove(ev: PointerEvent) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const colDelta = Math.round(dx / (gridMeta.colWidth + gap));
        const rowDelta = Math.round(dy / (gridMeta.rowHeight + gap));
        const newColSpan = Math.max(1, Math.min(3 - layout.colStart, startColSpan + colDelta));
        const newRowSpan = Math.max(1, startRowSpan + rowDelta);
        if (newColSpan !== layout.colSpan || newRowSpan !== layout.rowSpan) {
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
    [id, layout, gridMeta, onResize]
  );

  const style: React.CSSProperties = {
    gridColumn: `${layout.colStart} / span ${layout.colSpan}`,
    gridRow: `${layout.rowStart} / span ${layout.rowSpan}`,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/tile relative ${autoHeight ? "" : "overflow-hidden"} rounded-[8px] border border-primary/50 bg-bg`}
    >
      <div
        {...listeners}
        {...attributes}
        style={{ touchAction: "none" }}
        className="flex h-4 cursor-grab items-center justify-center border-b border-primary/20 active:cursor-grabbing"
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
        className="absolute bottom-0.5 right-0.5 flex size-4 cursor-nwse-resize items-center justify-center"
      >
        <svg viewBox="0 0 10 10" className="size-2.5 text-text/30">
          <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
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
                gridTemplateColumns: "repeat(2, 1fr)",
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
                >
                  <div className="pointer-events-none overflow-hidden">
                    <div style={{ width: "142.86%", transform: "scale(0.7)", transformOrigin: "top left" }}>
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
