"use client";

import { motion } from "framer-motion";
import { COVER_COLORS } from "@/lib/constants/colors";
import type { BlockStyle } from "@/lib/types/blocks";

interface BlockStyleToolbarProps {
  style: BlockStyle | undefined;
  onChange: (patch: Partial<BlockStyle>) => void;
}

export function BlockStyleToolbar({ style, onChange }: BlockStyleToolbarProps) {
  const current = style?.background_color ?? null;
  const borderless = !!style?.borderless;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      data-block-style-toolbar="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-2 rounded-[15px] border border-primary bg-bg p-2 shadow-md"
    >
      <button
        type="button"
        onClick={() => onChange({ background_color: null })}
        title="No background"
        className={`flex size-6 items-center justify-center rounded-full border border-primary/60 bg-bg ${
          current === null ? "ring-2 ring-accent ring-offset-1 ring-offset-bg" : ""
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-3 text-text/40">
          <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {COVER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange({ background_color: c })}
          title={c}
          style={{ backgroundColor: c }}
          className={`size-6 rounded-full ${
            current === c ? "ring-2 ring-accent ring-offset-1 ring-offset-bg" : ""
          }`}
        />
      ))}
      <span className="mx-1 h-5 w-px bg-primary" />
      <button
        type="button"
        onClick={() => onChange({ borderless: !borderless })}
        title={borderless ? "Show border" : "Hide border"}
        className={`flex size-6 items-center justify-center rounded-[6px] hover:bg-text/10 ${
          borderless ? "text-accent" : "text-text"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="4" strokeDasharray="4 3" />
        </svg>
      </button>
    </motion.div>
  );
}
