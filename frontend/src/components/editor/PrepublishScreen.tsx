"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import type { Block, BlockStyle, Post } from "@/lib/types/blocks";
import { COVER_COLORS, isDarkColor } from "@/lib/constants/colors";
import { MOBILE_HIDDEN_LAYOUT, isMobileHidden, type MobileLayout } from "@/lib/types/grid";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { PostCard } from "@/components/feed/PostCard";
import { DEFAULT_MOBILE_LAYOUTS } from "./EditorCanvas";
import { countWords } from "@/lib/utils/wordcount";

interface PrepublishScreenProps {
  post: Post;
  blocks: Block[];
  username: string;
  onPublish: (coverColor: string, tags: string[]) => void;
  onSaveDraft: () => void;
  onCancel: () => void;
  onMobileLayoutChange: (blockId: string, changes: Partial<MobileLayout>) => void;
}

// The preview renders at a real phone width, unscaled, so what the author sees
// is exactly what BentoGridMobile/BentoTileMobile will render after publishing.
const GAP = 12;
const PHONE_CONTENT_WIDTH = 360;
const COL_WIDTH = (PHONE_CONTENT_WIDTH - GAP) / 2; // 174
const ROW_HEIGHT = COL_WIDTH / 2; // 87 — same colWidth/2 rule as the live grid
const MAX_ROW_SPAN = 12;

interface TileSize {
  colSpan: number;
  rowSpan: number;
}

function rowsNeededFor(contentHeight: number): number {
  return Math.max(1, Math.ceil((contentHeight + GAP) / (ROW_HEIGHT + GAP)));
}

// Compile the ordered flow of tiles into explicit grid coordinates. Full-width
// tiles take their own row band; consecutive half-width tiles pair up side by
// side. Overlaps and stray gaps are impossible by construction.
function packLayouts(order: string[], sizes: Record<string, TileSize>): Map<string, MobileLayout> {
  const out = new Map<string, MobileLayout>();
  let cursor = 1;
  let pending: { rowSpan: number } | null = null;
  for (const id of order) {
    const size = sizes[id] ?? { colSpan: 1, rowSpan: 2 };
    const colSpan = Math.max(1, Math.min(2, size.colSpan));
    const rowSpan = Math.max(1, size.rowSpan);
    if (colSpan === 2) {
      if (pending) {
        cursor += pending.rowSpan;
        pending = null;
      }
      out.set(id, { colStart: 1, colSpan: 2, rowStart: cursor, rowSpan });
      cursor += rowSpan;
    } else if (!pending) {
      out.set(id, { colStart: 1, colSpan: 1, rowStart: cursor, rowSpan });
      pending = { rowSpan };
    } else {
      out.set(id, { colStart: 2, colSpan: 1, rowStart: cursor, rowSpan });
      cursor += Math.max(pending.rowSpan, rowSpan);
      pending = null;
    }
  }
  return out;
}

function defaultSizeFor(type: string): TileSize {
  const def = DEFAULT_MOBILE_LAYOUTS[type] || { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 };
  return {
    colSpan: Math.max(1, Math.min(2, def.colSpan)),
    rowSpan: Math.max(1, def.rowSpan),
  };
}

// Derive the starting arrangement from what's already saved. Blocks with a
// real mobile layout keep it (ordered top-to-bottom); blocks the author hid on
// a previous visit stay hidden. Only when nothing is placed at all do we start
// fresh with every block, in desktop reading order.
function initialArrangement(blocks: Block[]): { order: string[]; sizes: Record<string, TileSize> } {
  const tops = blocks.filter((b) => !b.parent_block_id);
  const placed = tops.filter((b) => !isMobileHidden(b.grid_layout_mobile));
  const fresh = placed.length === 0;
  const source = fresh ? tops : placed;
  const sorted = [...source].sort((a, b) => {
    const la = fresh ? a.grid_layout_desktop : a.grid_layout_mobile;
    const lb = fresh ? b.grid_layout_desktop : b.grid_layout_mobile;
    return la.rowStart - lb.rowStart || la.colStart - lb.colStart;
  });
  const sizes: Record<string, TileSize> = {};
  for (const b of tops) {
    if (!fresh && !isMobileHidden(b.grid_layout_mobile)) {
      sizes[b.id] = {
        colSpan: Math.max(1, Math.min(2, b.grid_layout_mobile.colSpan)),
        rowSpan: Math.max(1, b.grid_layout_mobile.rowSpan),
      };
    } else {
      sizes[b.id] = defaultSizeFor(b.type);
    }
  }
  return { order: sorted.map((b) => b.id), sizes };
}

function sameLayout(a: MobileLayout, b: MobileLayout): boolean {
  return (
    a.colStart === b.colStart &&
    a.colSpan === b.colSpan &&
    a.rowStart === b.rowStart &&
    a.rowSpan === b.rowSpan
  );
}

function tileChromeStyle(blockStyle?: BlockStyle) {
  const bgColor = blockStyle?.background_color;
  const dark = isDarkColor(bgColor);
  return {
    style: {
      ...(bgColor ? { backgroundColor: bgColor } : {}),
      ...(dark ? { color: "#eff1f3" } : {}),
    },
    bgClass: bgColor ? "" : "bg-bg",
    borderClass: blockStyle?.borderless ? "" : "border border-primary",
  };
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // The whole tile is a drag handle — stop the gesture so dnd-kit doesn't claim it.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-6 items-center justify-center rounded-full border border-primary/40 bg-bg/90 text-text/70 shadow-sm backdrop-blur hover:text-text"
    >
      {children}
    </button>
  );
}

function PhoneTile({
  block,
  layout,
  autoHeight,
  selected,
  animate,
  onSelect,
  onToggleWidth,
  onRowsDelta,
  onHide,
  onAutoRows,
}: {
  block: Block;
  layout: MobileLayout;
  autoHeight: boolean;
  selected: boolean;
  animate: boolean;
  onSelect: (id: string) => void;
  onToggleWidth: (id: string) => void;
  onRowsDelta: (id: string, delta: number) => void;
  onHide: (id: string) => void;
  onAutoRows: (id: string, rows: number) => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: block.id,
  });
  const { setNodeRef: setDropRef } = useDroppable({ id: block.id });
  const contentRef = useRef<HTMLDivElement>(null);

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  // Markdown tiles size themselves to their content, exactly like the live
  // viewer does. The content's height doesn't depend on the tile's rowSpan
  // (it flows naturally), so this converges in a single step — no feedback
  // loop with any manual control.
  useEffect(() => {
    if (!autoHeight) return;
    const el = contentRef.current;
    if (!el) return;

    function measure() {
      const h = el!.scrollHeight;
      if (!h) return;
      onAutoRows(block.id, rowsNeededFor(h));
    }

    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoHeight, block.id, onAutoRows]);

  const chrome = tileChromeStyle(block.style);
  const isFull = layout.colSpan === 2;

  return (
    <motion.div
      ref={setRefs}
      layout={animate ? "position" : false}
      transition={{ layout: { type: "spring", stiffness: 400, damping: 32 } }}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(block.id)}
      style={{
        gridColumn: `${layout.colStart} / span ${layout.colSpan}`,
        gridRow: `${layout.rowStart} / span ${layout.rowSpan}`,
        touchAction: "none",
        minWidth: 0,
        ...chrome.style,
      }}
      className={`group/tile relative cursor-grab rounded-[15px] active:cursor-grabbing ${chrome.bgClass} ${chrome.borderClass} ${
        autoHeight ? "" : "overflow-hidden"
      } ${isDragging ? "opacity-30" : ""} ${selected ? "ring-2 ring-accent" : ""}`}
    >
      <div ref={contentRef} className={`pointer-events-none select-none ${autoHeight ? "" : "h-full"}`}>
        <BlockRenderer block={block} />
      </div>

      <div
        className={`absolute right-1.5 top-1.5 z-10 flex gap-1 transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
        }`}
      >
        <ControlButton
          label={isFull ? "Make half width" : "Make full width"}
          onClick={() => onToggleWidth(block.id)}
        >
          {isFull ? (
            <svg viewBox="0 0 14 14" className="size-3">
              <path
                d="M6 4L4 7l2 3M8 4l2 3-2 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 14 14" className="size-3">
              <path
                d="M4 4L2 7l2 3M10 4l2 3-2 3M2 7h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </ControlButton>
        {!autoHeight && (
          <>
            <ControlButton label="Decrease tile height" onClick={() => onRowsDelta(block.id, -1)}>
              <svg viewBox="0 0 14 14" className="size-3">
                <path d="M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </ControlButton>
            <ControlButton label="Increase tile height" onClick={() => onRowsDelta(block.id, 1)}>
              <svg viewBox="0 0 14 14" className="size-3">
                <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </ControlButton>
          </>
        )}
        <ControlButton label="Hide on mobile" onClick={() => onHide(block.id)}>
          <svg viewBox="0 0 14 14" className="size-3">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </ControlButton>
      </div>
    </motion.div>
  );
}

function HiddenBlockCard({ block, onShow }: { block: Block; onShow: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-primary/50 bg-bg">
      <div className="flex items-center justify-between border-b border-primary/20 px-2 py-1">
        <span className="text-[10px] uppercase tracking-wide text-text/60">{block.type}</span>
        <button
          type="button"
          aria-label="Show on mobile"
          title="Show on mobile"
          onClick={() => onShow(block.id)}
          className="flex size-5 items-center justify-center rounded-full text-text/50 hover:bg-text/10 hover:text-text"
        >
          <svg viewBox="0 0 14 14" className="size-3">
            <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        onClick={() => onShow(block.id)}
        className="block h-[72px] w-full cursor-pointer overflow-hidden text-left"
      >
        <div className="pointer-events-none" style={{ width: "200%", height: "200%", transform: "scale(0.5)", transformOrigin: "top left" }}>
          <BlockRenderer block={block} />
        </div>
      </button>
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
  // Starts true — the motion.div's initial→animate handles the entrance;
  // setting it false plays the exit through AnimatePresence.
  const [visible, setVisible] = useState(true);
  const [coverColor, setCoverColor] = useState(post.cover_color || COVER_COLORS[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [initial] = useState(() => initialArrangement(blocks));
  const [order, setOrder] = useState<string[]>(initial.order);
  const [sizes, setSizes] = useState<Record<string, TileSize>>(initial.sizes);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  const topLevel = useMemo(() => blocks.filter((b) => !b.parent_block_id), [blocks]);
  const blockById = useMemo(() => new Map(topLevel.map((b) => [b.id, b])), [topLevel]);
  const hidden = useMemo(() => topLevel.filter((b) => !order.includes(b.id)), [topLevel, order]);
  const layouts = useMemo(() => packLayouts(order, sizes), [order, sizes]);

  const readingMinutes = useMemo(() => {
    const words = blocks
      .filter((b) => b.type === "markdown" && !b.parent_block_id)
      .reduce(
        (sum, b) => sum + countWords((b.content as { markdown?: string }).markdown || ""),
        0
      );
    return Math.max(1, Math.round(words / 200));
  }, [blocks]);

  // Single persistence path: whatever the packed layout says a block should
  // be, write it upstream when it differs from what's saved. Every mutation
  // (reorder, resize, hide, show) funnels through this diff, so the editor
  // state can never drift from what the phone preview shows.
  useEffect(() => {
    for (const b of topLevel) {
      const desired = layouts.get(b.id) ?? MOBILE_HIDDEN_LAYOUT;
      if (!sameLayout(b.grid_layout_mobile, desired)) {
        onMobileLayoutChange(b.id, desired);
      }
    }
  }, [layouts, topLevel, onMobileLayoutChange]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    setSelectedId(null);
  }

  // Live reorder: as the dragged tile crosses another tile, move it to that
  // slot and let the grid repack. The dragged tile's own slot then sits under
  // the pointer, which naturally stabilizes the gesture.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || over.id === active.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(active.id as string);
      const to = prev.indexOf(over.id as string);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, active.id as string);
      return next;
    });
  }

  function handleDragEnd() {
    setActiveId(null);
  }

  const handleToggleWidth = useCallback((id: string) => {
    setSizes((prev) => {
      const cur = prev[id] ?? { colSpan: 1, rowSpan: 2 };
      return { ...prev, [id]: { ...cur, colSpan: cur.colSpan === 2 ? 1 : 2 } };
    });
  }, []);

  const handleRowsDelta = useCallback((id: string, delta: number) => {
    setSizes((prev) => {
      const cur = prev[id] ?? { colSpan: 1, rowSpan: 2 };
      const rowSpan = Math.max(1, Math.min(MAX_ROW_SPAN, cur.rowSpan + delta));
      if (rowSpan === cur.rowSpan) return prev;
      return { ...prev, [id]: { ...cur, rowSpan } };
    });
  }, []);

  const handleAutoRows = useCallback((id: string, rows: number) => {
    setSizes((prev) => {
      const cur = prev[id] ?? { colSpan: 1, rowSpan: 2 };
      if (cur.rowSpan === rows) return prev;
      return { ...prev, [id]: { ...cur, rowSpan: rows } };
    });
  }, []);

  const handleHide = useCallback((id: string) => {
    setOrder((prev) => prev.filter((x) => x !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const handleShow = useCallback(
    (id: string) => {
      setSizes((prev) => (prev[id] ? prev : { ...prev, [id]: defaultSizeFor(blockById.get(id)?.type || "markdown") }));
      setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [blockById]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
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

  const activeBlock = activeId ? blockById.get(activeId) : null;
  const activeChrome = activeBlock ? tileChromeStyle(activeBlock.style) : null;
  const handle = username ? `@${username}` : "you";
  const pageName = username ? `${username}'s page` : "Patches";
  const metaBits = [handle, `Week ${post.week_number}, ${post.year}`, `${readingMinutes} min read`];
  const orderedBlocks = order
    .map((id) => blockById.get(id))
    .filter((b): b is Block => !!b);

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
                  This is exactly how your post will look on phones. Drag tiles to reorder them,
                  and use each tile&apos;s controls to change its width or height — or hide it from
                  mobile entirely. Then pick your tags and cover.
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragEnd}
                >
                  <div className="flex items-start gap-8">
                    <div className="flex w-[190px] shrink-0 flex-col">
                      <h2 className="mb-3 font-[family-name:var(--font-cabinet)] text-sm font-bold uppercase tracking-wide text-text/60">
                        Hidden on mobile ({hidden.length})
                      </h2>
                      <div className="flex flex-col gap-2 rounded-[15px] border border-primary/30 bg-text/[0.02] p-2" style={{ minHeight: 120 }}>
                        {hidden.length === 0 ? (
                          <p className="px-2 py-6 text-center text-xs text-text/40">
                            hide a tile and it&apos;ll land here — hidden tiles still show on desktop
                          </p>
                        ) : (
                          hidden.map((block) => (
                            <HiddenBlockCard key={block.id} block={block} onShow={handleShow} />
                          ))
                        )}
                      </div>
                    </div>

                    <div className="sticky top-0 shrink-0 self-start">
                      <div className="rounded-[44px] border-[6px] border-text/80 bg-bg shadow-xl">
                        <div className="flex flex-col px-3 pb-3 pt-2" style={{ width: PHONE_CONTENT_WIDTH + 24 }}>
                          <div className="mx-auto mb-2 h-4 w-20 rounded-full bg-text/80" />

                          <div className="mb-2 flex items-center gap-2 px-1">
                            <svg width="12" height="12" viewBox="0 0 12 12" className="text-text/60">
                              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                            </svg>
                            <span className="truncate text-xs text-text/60">{pageName}</span>
                          </div>

                          <div className="min-h-[420px] overflow-y-auto overscroll-contain rounded-[12px] pb-4" style={{ height: "calc(100vh - 260px)" }}>
                            <h2 className="mb-1 font-[family-name:var(--font-cabinet)] text-xl font-bold leading-tight">
                              {post.title || "Untitled"}
                            </h2>
                            <p className="mb-3 text-[11px] text-text/40">
                              {metaBits.join(" · ")}
                            </p>

                            {orderedBlocks.length === 0 ? (
                              <div className="flex h-[200px] items-center justify-center rounded-[12px] border border-dashed border-text/20">
                                <p className="px-6 text-center text-xs text-text/40">
                                  nothing to show on mobile yet — add tiles back from the hidden list
                                </p>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: `repeat(2, ${COL_WIDTH}px)`,
                                  gridAutoRows: ROW_HEIGHT,
                                  gap: GAP,
                                  width: PHONE_CONTENT_WIDTH,
                                }}
                              >
                                {orderedBlocks.map((block) => (
                                  <PhoneTile
                                    key={block.id}
                                    block={block}
                                    layout={layouts.get(block.id)!}
                                    autoHeight={block.type === "markdown"}
                                    selected={selectedId === block.id}
                                    animate={activeId === null}
                                    onSelect={handleSelect}
                                    onToggleWidth={handleToggleWidth}
                                    onRowsDelta={handleRowsDelta}
                                    onHide={handleHide}
                                    onAutoRows={handleAutoRows}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-around border-t border-primary/30 pt-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" className="rotate-45 text-text/40">
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

                  <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
                    {activeBlock && activeChrome && (
                      <div
                        className={`h-full w-full cursor-grabbing rounded-[15px] shadow-2xl ${activeChrome.bgClass} ${activeChrome.borderClass} overflow-hidden`}
                        style={activeChrome.style}
                      >
                        <div className="pointer-events-none h-full select-none">
                          <BlockRenderer block={activeBlock} />
                        </div>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
