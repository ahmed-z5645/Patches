"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query-keys";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Block, BlockType, Post } from "@/lib/types/blocks";
import type { DesktopLayout, MobileLayout } from "@/lib/types/grid";
import { AnimatePresence } from "framer-motion";
import { BentoGrid, BentoGridMobile } from "@/components/bento/BentoGrid";
import { DraggableTile } from "@/components/bento/DraggableTile";
import { MobileDraggableTile } from "@/components/bento/MobileDraggableTile";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { PrepublishScreen } from "./PrepublishScreen";
import { TitleInput } from "./TitleInput";
import { WordCounter } from "./WordCounter";
import { GhostBlockOverlay } from "./GhostBlockOverlay";
import { MobileGhostBlockOverlay } from "./MobileGhostBlockOverlay";
import { PublishButton } from "./PublishButton";
import { countWords } from "@/lib/utils/wordcount";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_MOBILE_LAYOUTS: Record<string, MobileLayout> = {
  markdown: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
  image: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
  quote: { colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 2 },
  code: { colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 4 },
  spotify: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
  apple_music: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
  strava: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
  map: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
  weather: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
};

function isMobileCellOccupied(blocks: Block[], col: number, row: number): boolean {
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

function findNextMobilePosition(blocks: Block[]): MobileLayout {
  const topLevel = blocks.filter((b) => !b.parent_block_id);
  if (topLevel.length === 0) {
    return { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 };
  }
  let maxRow = 0;
  for (const b of topLevel) {
    const end = b.grid_layout_mobile.rowStart + b.grid_layout_mobile.rowSpan;
    if (end > maxRow) maxRow = end;
  }
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= 2; c++) {
      if (!isMobileCellOccupied(topLevel, c, r)) {
        return { colStart: c, colSpan: 1, rowStart: r, rowSpan: 2 };
      }
    }
  }
  return { colStart: 1, colSpan: 1, rowStart: maxRow, rowSpan: 2 };
}

interface EditorCanvasProps {
  post: Post;
  initialBlocks: Block[];
}

const DEFAULT_LAYOUTS: Record<string, DesktopLayout> = {
  markdown: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
  image: { colStart: 3, colSpan: 1, rowStart: 1, rowSpan: 2 },
  quote: { colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 2 },
  code: { colStart: 3, colSpan: 2, rowStart: 1, rowSpan: 4 },
  spotify: { colStart: 4, colSpan: 1, rowStart: 1, rowSpan: 2 },
  apple_music: { colStart: 4, colSpan: 1, rowStart: 1, rowSpan: 2 },
  strava: { colStart: 4, colSpan: 1, rowStart: 1, rowSpan: 2 },
  map: { colStart: 4, colSpan: 1, rowStart: 1, rowSpan: 2 },
  weather: { colStart: 4, colSpan: 1, rowStart: 1, rowSpan: 2 },
};

function findNextPosition(blocks: Block[]): DesktopLayout {
  if (blocks.length === 0) {
    return { colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 4 };
  }
  let maxRow = 0;
  for (const b of blocks) {
    const end = b.grid_layout_desktop.rowStart + b.grid_layout_desktop.rowSpan;
    if (end > maxRow) maxRow = end;
  }
  return { colStart: 1, colSpan: 1, rowStart: maxRow, rowSpan: 2 };
}

export function EditorCanvas({ post, initialBlocks }: EditorCanvasProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(post.title || "");
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showMobileReview, setShowMobileReview] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [username, setUsername] = useState("");
  const dirtyBlocksRef = useRef<Set<string>>(new Set());
  const dirtyLayoutsRef = useRef<Set<string>>(new Set());
  const pendingCreatesRef = useRef<Set<string>>(new Set());
  const pendingDeletesRef = useRef<Set<string>>(new Set());

  const gridRef = useRef<HTMLDivElement>(null);
  const mobileGridRef = useRef<HTMLDivElement>(null);
  const [gridMeta, setGridMeta] = useState({ colWidth: 0, rowHeight: 0 });
  const [mobileGridMeta, setMobileGridMeta] = useState({ colWidth: 0, rowHeight: 0 });

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUsername(data.user?.user_metadata?.username || "");
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    function update() {
      if (!gridRef.current) return;
      const w = gridRef.current.clientWidth;
      const gap = 16;
      const colWidth = (w - gap * 3) / 4;
      setGridMeta({ colWidth, rowHeight: colWidth / 2 });
    }
    update();
    const obs = new ResizeObserver(update);
    if (gridRef.current) obs.observe(gridRef.current);
    return () => obs.disconnect();
  }, [isMobile]);

  useEffect(() => {
    function update() {
      if (!mobileGridRef.current) return;
      const w = mobileGridRef.current.clientWidth;
      const gap = 12;
      const colWidth = (w - gap) / 2;
      setMobileGridMeta({ colWidth, rowHeight: colWidth / 2 });
    }
    update();
    const obs = new ResizeObserver(update);
    if (mobileGridRef.current) obs.observe(mobileGridRef.current);
    return () => obs.disconnect();
  }, [isMobile]);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(touchSensor, pointerSensor);

  const wordCount = useMemo(() => {
    return blocks
      .filter((b) => b.type === "markdown" && !b.parent_block_id)
      .reduce(
        (sum, b) =>
          sum + countWords((b.content as { markdown: string }).markdown),
        0
      );
  }, [blocks]);

  const canPublish = title.trim().length > 0 && wordCount >= 100;

  const topLevelBlocks = blocks.filter((b) => !b.parent_block_id);
  const childBlocksMap = useMemo(() => {
    const map: Record<string, Block[]> = {};
    for (const b of blocks) {
      if (b.parent_block_id) {
        if (!map[b.parent_block_id]) map[b.parent_block_id] = [];
        map[b.parent_block_id].push(b);
      }
    }
    return map;
  }, [blocks]);

  const saveAll = useCallback(async () => {
    const hasCreates = pendingCreatesRef.current.size > 0;
    const hasDeletes = pendingDeletesRef.current.size > 0;
    if (!hasUnsavedChanges && !hasCreates && !hasDeletes) return;
    setIsSaving(true);
    try {
      // Phase 1: Create staged blocks — content/layout come from current state
      for (const tempId of pendingCreatesRef.current) {
        const block = blocks.find((b) => b.id === tempId);
        if (!block) continue;
        const created = await api.post<Block>(`/api/posts/${post.id}/blocks`, {
          type: block.type,
          content: block.content,
          grid_layout_desktop: block.grid_layout_desktop,
          grid_layout_mobile: block.grid_layout_mobile,
        });
        setBlocks((prev) =>
          prev.map((b) => (b.id === tempId ? { ...b, id: created.id } : b))
        );
        // Block was just created with current content — no need to re-PUT
        dirtyBlocksRef.current.delete(tempId);
        dirtyLayoutsRef.current.delete(tempId);
      }
      pendingCreatesRef.current.clear();

      // Phase 2: Update post title + dirty blocks/layouts in parallel
      const promises: Promise<unknown>[] = [];
      promises.push(api.put(`/api/posts/${post.id}`, { title }));
      for (const blockId of dirtyBlocksRef.current) {
        const block = blocks.find((b) => b.id === blockId);
        if (block) {
          promises.push(
            api.put(`/api/blocks/${blockId}`, { content: block.content, z_index: block.z_index })
          );
        }
      }
      for (const blockId of dirtyLayoutsRef.current) {
        const block = blocks.find((b) => b.id === blockId);
        if (block) {
          promises.push(
            api.put(`/api/blocks/${blockId}/layout`, {
              grid_layout_desktop: block.grid_layout_desktop,
              grid_layout_mobile: block.grid_layout_mobile,
            })
          );
        }
      }
      await Promise.all(promises);
      dirtyBlocksRef.current.clear();
      dirtyLayoutsRef.current.clear();
      setHasUnsavedChanges(false);

      // Phase 3: Delete removed blocks
      if (pendingDeletesRef.current.size > 0) {
        await Promise.all(
          [...pendingDeletesRef.current].map((id) => api.delete(`/api/blocks/${id}`))
        );
        pendingDeletesRef.current.clear();
      }

      queryClient.invalidateQueries({ queryKey: keys.post(post.id) });
      queryClient.invalidateQueries({ queryKey: keys.postBlocks(post.id) });
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setIsSaving(false);
    }
  }, [hasUnsavedChanges, title, blocks, post.id, queryClient]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveAll();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveAll]);

  const handleUpdateBlock = useCallback(
    (blockId: string, content: Record<string, unknown>) => {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId ? ({ ...b, content } as Block) : b
        )
      );
      dirtyBlocksRef.current.add(blockId);
      setHasUnsavedChanges(true);
    },
    []
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    if (!gridMeta.colWidth || !gridMeta.rowHeight) return;

    const blockId = active.id as string;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const gap = 16;
    const colDelta = Math.round(delta.x / (gridMeta.colWidth + gap));
    const rowDelta = Math.round(delta.y / (gridMeta.rowHeight + gap));

    if (colDelta === 0 && rowDelta === 0) return;

    const layout = block.grid_layout_desktop;
    const newColStart = Math.max(1, Math.min(5 - layout.colSpan, layout.colStart + colDelta));
    const newRowStart = Math.max(1, layout.rowStart + rowDelta);

    setBlocks((prev) => {
      const maxZ = Math.max(0, ...prev.map((b) => b.z_index || 0));
      return prev.map((b) =>
        b.id === blockId
          ? {
              ...b,
              z_index: maxZ + 1,
              grid_layout_desktop: {
                ...b.grid_layout_desktop,
                colStart: newColStart,
                rowStart: newRowStart,
              },
            }
          : b
      );
    });
    dirtyBlocksRef.current.add(blockId);
    dirtyLayoutsRef.current.add(blockId);
    setHasUnsavedChanges(true);
  }

  function handleMobileDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    if (!mobileGridMeta.colWidth || !mobileGridMeta.rowHeight) return;

    const blockId = active.id as string;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const gap = 12;
    const colDelta = Math.round(delta.x / (mobileGridMeta.colWidth + gap));
    const rowDelta = Math.round(delta.y / (mobileGridMeta.rowHeight + gap));

    if (colDelta === 0 && rowDelta === 0) return;

    const layout = block.grid_layout_mobile;
    const newColStart = Math.max(1, Math.min(3 - layout.colSpan, layout.colStart + colDelta));
    const newRowStart = Math.max(1, layout.rowStart + rowDelta);

    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? {
              ...b,
              grid_layout_mobile: {
                ...b.grid_layout_mobile,
                colStart: newColStart,
                rowStart: newRowStart,
              },
            }
          : b
      )
    );
    dirtyLayoutsRef.current.add(blockId);
    setHasUnsavedChanges(true);
  }

  function handleMobileResize(blockId: string, changes: Partial<MobileLayout>) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? {
              ...b,
              grid_layout_mobile: { ...b.grid_layout_mobile, ...changes },
            }
          : b
      )
    );
    dirtyLayoutsRef.current.add(blockId);
    setHasUnsavedChanges(true);
  }

  function handleResize(blockId: string, changes: Partial<DesktopLayout>) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? {
              ...b,
              grid_layout_desktop: { ...b.grid_layout_desktop, ...changes },
            }
          : b
      )
    );
    dirtyLayoutsRef.current.add(blockId);
    setHasUnsavedChanges(true);
  }

  function buildLocalBlock(
    type: BlockType,
    gridLayout: DesktopLayout,
    mobileGridLayout: MobileLayout
  ): Block {
    const tempId = `temp-${crypto.randomUUID()}`;
    const content =
      type === "markdown"
        ? { markdown: "" }
        : type === "quote"
          ? { text: "" }
          : type === "code"
            ? { code: "", language: "javascript" }
            : {};
    return {
      id: tempId,
      post_id: post.id,
      parent_block_id: null,
      type,
      content,
      grid_layout_desktop: gridLayout,
      grid_layout_mobile: mobileGridLayout,
      float_position: null,
      z_index: 0,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Block;
  }

  function handleAddBlock(type: BlockType, col?: number, row?: number) {
    const defaults = DEFAULT_LAYOUTS[type] || { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 };
    const position =
      col != null && row != null ? { colStart: col, rowStart: row } : findNextPosition(blocks);
    const gridLayout = { ...defaults, colStart: position.colStart, rowStart: position.rowStart };

    const mobileDefaults = DEFAULT_MOBILE_LAYOUTS[type] || { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 };
    const mobilePosition = findNextMobilePosition(blocks);
    const mobileGridLayout = { ...mobileDefaults, colStart: mobilePosition.colStart, rowStart: mobilePosition.rowStart };

    const newBlock = buildLocalBlock(type, gridLayout, mobileGridLayout);
    pendingCreatesRef.current.add(newBlock.id);
    setBlocks((prev) => [...prev, newBlock]);
    setHasUnsavedChanges(true);
  }

  function handleMobileAddBlock(type: BlockType, col?: number, row?: number) {
    const mobileDefaults = DEFAULT_MOBILE_LAYOUTS[type] || { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 };
    const position =
      col != null && row != null ? { colStart: col, rowStart: row } : findNextMobilePosition(blocks);
    const mobileGridLayout = { ...mobileDefaults, colStart: position.colStart, rowStart: position.rowStart };

    const desktopDefaults = DEFAULT_LAYOUTS[type] || { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 };
    const desktopPosition = findNextPosition(blocks);
    const desktopGridLayout = { ...desktopDefaults, colStart: desktopPosition.colStart, rowStart: desktopPosition.rowStart };

    const newBlock = buildLocalBlock(type, desktopGridLayout, mobileGridLayout);
    pendingCreatesRef.current.add(newBlock.id);
    setBlocks((prev) => [...prev, newBlock]);
    setHasUnsavedChanges(true);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    setHasUnsavedChanges(true);
  }

  function handlePublishClick() {
    setShowMobileReview(true);
  }

  async function handlePrepublish(coverColor: string, tags: string[]) {
    setIsPublishing(true);
    setShowMobileReview(false);
    try {
      // Phase 1: Create any staged blocks
      for (const tempId of pendingCreatesRef.current) {
        const block = blocks.find((b) => b.id === tempId);
        if (!block) continue;
        const created = await api.post<Block>(`/api/posts/${post.id}/blocks`, {
          type: block.type,
          content: block.content,
          grid_layout_desktop: block.grid_layout_desktop,
          grid_layout_mobile: block.grid_layout_mobile,
        });
        setBlocks((prev) =>
          prev.map((b) => (b.id === tempId ? { ...b, id: created.id } : b))
        );
        dirtyBlocksRef.current.delete(tempId);
        dirtyLayoutsRef.current.delete(tempId);
      }
      pendingCreatesRef.current.clear();

      // Phase 2: Save post (with cover/tags) + dirty blocks
      await api.put(`/api/posts/${post.id}`, { title, cover_color: coverColor, tags });
      for (const blockId of dirtyBlocksRef.current) {
        const block = blocks.find((b) => b.id === blockId);
        if (block) {
          await api.put(`/api/blocks/${blockId}`, { content: block.content, z_index: block.z_index });
        }
      }
      for (const blockId of dirtyLayoutsRef.current) {
        const block = blocks.find((b) => b.id === blockId);
        if (block) {
          await api.put(`/api/blocks/${blockId}/layout`, {
            grid_layout_desktop: block.grid_layout_desktop,
            grid_layout_mobile: block.grid_layout_mobile,
          });
        }
      }
      dirtyBlocksRef.current.clear();
      dirtyLayoutsRef.current.clear();

      // Phase 3: Delete removed blocks
      await Promise.all(
        [...pendingDeletesRef.current].map((id) => api.delete(`/api/blocks/${id}`))
      );
      pendingDeletesRef.current.clear();

      await api.post(`/api/posts/${post.id}/publish`);
      window.location.href = "/feed";
    } catch (e) {
      console.error("Failed to publish:", e);
      setIsPublishing(false);
    }
  }

  async function handleSaveDraft() {
    setShowMobileReview(false);
    await saveAll();
  }

  function handleDeleteBlock(blockId: string) {
    if (blockId.startsWith("temp-")) {
      pendingCreatesRef.current.delete(blockId);
    } else {
      pendingDeletesRef.current.add(blockId);
    }
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    dirtyBlocksRef.current.delete(blockId);
    dirtyLayoutsRef.current.delete(blockId);
    setHasUnsavedChanges(true);
  }

  const prepublishModal = showMobileReview && (
    <PrepublishScreen
      post={{ ...post, title }}
      blocks={blocks}
      username={username}
      onPublish={handlePrepublish}
      onSaveDraft={handleSaveDraft}
      onCancel={() => setShowMobileReview(false)}
      onMobileLayoutChange={handleMobileResize}
    />
  );

  if (isMobile) {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <WordCounter count={wordCount} />
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                onClick={saveAll}
                disabled={isSaving}
                className="rounded-[10px] border border-primary px-3 py-1.5 text-xs text-text/60 active:bg-primary/30 disabled:opacity-40"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            )}
            <PublishButton
              canPublish={canPublish}
              isPublishing={isPublishing}
              onPublish={handlePublishClick}
            />
          </div>
        </div>

        <TitleInput value={title} onChange={handleTitleChange} />

        <p className="text-sm text-text/40">
          {post.week_number && `Week ${post.week_number}, ${post.year}`}
        </p>

        <DndContext sensors={sensors} onDragEnd={handleMobileDragEnd}>
          <BentoGridMobile ref={mobileGridRef} minExtraRows={2} blocks={topLevelBlocks}>
            <AnimatePresence>
              {topLevelBlocks.map((block) => (
                <MobileDraggableTile
                  key={block.id}
                  id={block.id}
                  mobileLayout={block.grid_layout_mobile}
                  gridMeta={mobileGridMeta}
                  onResize={handleMobileResize}
                  className="group/tile relative border border-primary"
                  autoHeight={block.type === "markdown"}
                >
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-text/10 text-xs active:bg-accent active:text-white"
                  >
                    ×
                  </button>
                  <BlockRenderer
                    block={block}
                    childBlocks={childBlocksMap[block.id]}
                    isEditing={true}
                    onUpdate={handleUpdateBlock}
                  />
                </MobileDraggableTile>
              ))}
            </AnimatePresence>
            <MobileGhostBlockOverlay
              gridRef={mobileGridRef}
              blocks={blocks}
              onAddBlock={handleMobileAddBlock}
            />
          </BentoGridMobile>
        </DndContext>

        {prepublishModal}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <WordCounter count={wordCount} />
          {hasUnsavedChanges && (
            <span className="text-xs text-text/40">
              Unsaved changes — Ctrl+S to save
            </span>
          )}
          {isSaving && <span className="text-xs text-text/40">Saving...</span>}
        </div>
        <PublishButton
          canPublish={canPublish}
          isPublishing={isPublishing}
          onPublish={handlePublishClick}
        />
      </div>

      <TitleInput value={title} onChange={handleTitleChange} />

      <p className="text-sm text-text/40">
        {post.week_number && `Week ${post.week_number}, ${post.year}`}
      </p>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <BentoGrid ref={gridRef} minExtraRows={2} blocks={topLevelBlocks}>
          <AnimatePresence>
            {topLevelBlocks.map((block) => (
              <DraggableTile
                key={block.id}
                id={block.id}
                desktopLayout={block.grid_layout_desktop}
                mobileLayout={block.grid_layout_mobile}
                gridMeta={gridMeta}
                onResize={handleResize}
                className="group relative border border-primary"
                autoHeight={block.type === "markdown"}
                zIndex={block.z_index}
              >
                <button
                  onClick={() => handleDeleteBlock(block.id)}
                  className="absolute right-2 top-2 z-10 hidden size-6 items-center justify-center rounded-full bg-text/10 text-xs hover:bg-accent hover:text-white group-hover:flex"
                >
                  x
                </button>
                <BlockRenderer
                  block={block}
                  childBlocks={childBlocksMap[block.id]}
                  isEditing={true}
                  onUpdate={handleUpdateBlock}
                />
              </DraggableTile>
            ))}
          </AnimatePresence>
          <GhostBlockOverlay
            gridRef={gridRef}
            blocks={blocks}
            onAddBlock={handleAddBlock}
          />
        </BentoGrid>
      </DndContext>

      {prepublishModal}
    </div>
  );
}
