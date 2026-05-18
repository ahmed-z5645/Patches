"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ImageBlock as ImageBlockType } from "@/lib/types/blocks";
import { API_BASE_URL as API_URL } from "@/lib/api-url";

interface ImageBlockProps {
  block: ImageBlockType;
  isEditing?: boolean;
  onUpdate?: (content: { url: string; alt: string; caption?: string; cropX?: number; cropY?: number; cropZoom?: number }) => void;
}

// Helper to ensure math is identical in both modes
function getCoverMath(containerW: number, containerH: number, imageW: number, imageH: number, zoom: number, offsetX: number, offsetY: number) {
  // If dimensions aren't ready, return 0 to prevent "insane zoom" flashes
  if (!containerW || !imageW) {
    return { width: 0, height: 0, pxX: 0, pxY: 0, clampedX: 0, clampedY: 0 };
  }

  const scale = Math.max(containerW / imageW, containerH / imageH);
  const baseWidth = imageW * scale;
  const baseHeight = imageH * scale;

  const maxOffsetXPercent = (Math.max(0, (baseWidth * zoom - containerW) / 2) / containerW) * 100;
  const maxOffsetYPercent = (Math.max(0, (baseHeight * zoom - containerH) / 2) / containerH) * 100;

  const clampedX = Math.min(maxOffsetXPercent, Math.max(-maxOffsetXPercent, offsetX));
  const clampedY = Math.min(maxOffsetYPercent, Math.max(-maxOffsetYPercent, offsetY));

  const pxX = (clampedX / 100) * containerW;
  const pxY = (clampedY / 100) * containerH;

  return { width: baseWidth, height: baseHeight, pxX, pxY, clampedX, clampedY };
}

function ImageCropper({
  src,
  initialX,
  initialY,
  initialZoom,
  onConfirm,
  onCancel,
}: {
  src: string;
  initialX: number;
  initialY: number;
  initialZoom: number;
  onConfirm: (x: number, y: number, zoom: number) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });

  const [zoom, setZoom] = useState(initialZoom);
  const [offset, setOffset] = useState({ x: initialX, y: initialY });
  
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerSize({
        w: entries[0].contentRect.width,
        h: entries[0].contentRect.height,
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(3, Math.max(1, z - e.deltaY * 0.002)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const { width, height, pxX, pxY, clampedX, clampedY } = getCoverMath(
    containerSize.w, containerSize.h, imageSize.w, imageSize.h, zoom, offset.x, offset.y
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { x: clampedX, y: clampedY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [clampedX, clampedY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerSize.w) return;
    const dx = ((e.clientX - dragStart.current.x) / containerSize.w) * 100;
    const dy = ((e.clientY - dragStart.current.y) / containerSize.h) * 100;
    setOffset({
      x: offsetStart.current.x + dx,
      y: offsetStart.current.y + dy,
    });
  }, [containerSize]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    setOffset({ x: clampedX, y: clampedY });
  }, [clampedX, clampedY]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[15px]">
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => setImageSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="absolute select-none max-w-none transition-opacity duration-200"
          style={{
            opacity: width ? 1 : 0,
            width,
            height,
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translate(${pxX}px, ${pxY}px) scale(${zoom})`,
          }}
        />
      </div>
      
      <div className="absolute bottom-3 left-1/2 flex w-[90%] max-w-[320px] -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/20 bg-bg/95 px-4 py-2 shadow-lg backdrop-blur">
        <span className="text-xs font-medium text-text/60">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="flex-1 accent-accent"
        />
        <div className="flex gap-1">
          <button
            onClick={onCancel}
            className="rounded-[8px] px-2 py-1.5 text-xs font-medium text-text/60 hover:bg-text/5 hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(clampedX, clampedY, zoom)}
            className="rounded-[8px] bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImageBlock({ block, isEditing, onUpdate }: ImageBlockProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const displayContainerRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropping, setCropping] = useState(false);
  
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!displayContainerRef.current || cropping) return;
    const observer = new ResizeObserver((entries) => {
      setContainerSize({
        w: entries[0].contentRect.width,
        h: entries[0].contentRect.height,
      });
    });
    observer.observe(displayContainerRef.current);
    return () => observer.disconnect();
  }, [cropping]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      onUpdate?.({ url, alt: file.name });
      setCropping(true);
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  }

  function handleCropConfirm(x: number, y: number, zoom: number) {
    onUpdate?.({
      url: block.content.url,
      alt: block.content.alt,
      caption: block.content.caption,
      cropX: x,
      cropY: y,
      cropZoom: zoom,
    });
    setCropping(false);
  }

  if (isEditing && !block.content.url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-[15px] bg-primary/50 px-4 py-2 text-sm hover:bg-primary disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload image"}
        </button>
        <span className="text-xs text-text/30">or</span>
        <input
          type="text"
          placeholder="Paste image URL..."
          className="w-full rounded-[15px] border border-primary bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUpdate?.({ url: e.currentTarget.value, alt: "" });
              setCropping(true);
            }
          }}
        />
      </div>
    );
  }

  if (isEditing && cropping && block.content.url) {
    return (
      <ImageCropper
        src={block.content.url}
        initialX={(block.content as Record<string, unknown>).cropX as number || 0}
        initialY={(block.content as Record<string, unknown>).cropY as number || 0}
        initialZoom={(block.content as Record<string, unknown>).cropZoom as number || 1}
        onConfirm={handleCropConfirm}
        onCancel={() => setCropping(false)}
      />
    );
  }

  const cropX = (block.content as Record<string, unknown>).cropX as number || 0;
  const cropY = (block.content as Record<string, unknown>).cropY as number || 0;
  const cropZoom = (block.content as Record<string, unknown>).cropZoom as number || 1;

  if (block.content.url) {
    // Shared logic powers the final view too!
    const { width, height, pxX, pxY } = getCoverMath(
      containerSize.w, containerSize.h, imageSize.w, imageSize.h, cropZoom, cropX, cropY
    );

    return (
      <div ref={displayContainerRef} className="relative h-full w-full overflow-hidden rounded-[15px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.content.url}
          alt={block.content.alt}
          draggable={false}
          onLoad={(e) => setImageSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="absolute select-none max-w-none transition-opacity duration-200"
          style={{
            opacity: width ? 1 : 0, 
            width,
            height,
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translate(${pxX}px, ${pxY}px) scale(${cropZoom})`,
          }}
        />
        {block.content.caption && (
          <p className="absolute bottom-0 w-full bg-text/50 p-2 text-xs text-white backdrop-blur-sm">
            {block.content.caption}
          </p>
        )}
        {isEditing && (
          <button
            onClick={() => setCropping(true)}
            className="absolute left-2 top-2 rounded-full bg-text/50 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-md hover:bg-accent"
          >
            Adjust
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-text/30">
      No image
    </div>
  );
}