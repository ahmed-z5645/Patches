"use client";

import { useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ImageBlock as ImageBlockType } from "@/lib/types/blocks";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ImageBlockProps {
  block: ImageBlockType;
  isEditing?: boolean;
  onUpdate?: (content: { url: string; alt: string; caption?: string; cropX?: number; cropY?: number; cropZoom?: number }) => void;
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
  const [zoom, setZoom] = useState(initialZoom);
  const [offset, setOffset] = useState({ x: initialX, y: initialY });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.current.x) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.current.y) / rect.height) * 100;
    setOffset({
      x: Math.min(50, Math.max(-50, offsetStart.current.x + dx)),
      y: Math.min(50, Math.max(-50, offsetStart.current.y + dy)),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(1, z - e.deltaY * 0.002)));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 cursor-grab overflow-hidden rounded-t-[15px] active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute select-none"
          style={{
            width: `${zoom * 100}%`,
            height: `${zoom * 100}%`,
            objectFit: "cover",
            left: `${50 + offset.x - (zoom * 100) / 2}%`,
            top: `${50 + offset.y - (zoom * 100) / 2}%`,
          }}
        />
      </div>
      <div className="flex items-center gap-2 rounded-b-[15px] border-t border-primary bg-bg px-3 py-2">
        <span className="text-xs text-text/40">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="flex-1 accent-accent"
        />
        <button
          onClick={onCancel}
          className="rounded-[8px] px-3 py-1 text-xs text-text/50 hover:bg-text/5"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(offset.x, offset.y, zoom)}
          className="rounded-[8px] bg-accent px-3 py-1 text-xs text-white"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export function ImageBlock({ block, isEditing, onUpdate }: ImageBlockProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropping, setCropping] = useState(false);

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
    return (
      <div className="relative h-full overflow-hidden rounded-[15px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.content.url}
          alt={block.content.alt}
          className="absolute select-none"
          style={{
            width: `${cropZoom * 100}%`,
            height: `${cropZoom * 100}%`,
            objectFit: "cover",
            left: `${50 + cropX - (cropZoom * 100) / 2}%`,
            top: `${50 + cropY - (cropZoom * 100) / 2}%`,
          }}
        />
        {block.content.caption && (
          <p className="absolute bottom-0 w-full bg-text/50 p-2 text-xs text-white">
            {block.content.caption}
          </p>
        )}
        {isEditing && (
          <button
            onClick={() => setCropping(true)}
            className="absolute left-2 top-2 rounded-full bg-text/50 px-2 py-1 text-xs text-white hover:bg-accent"
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
