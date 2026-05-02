import type { DesktopLayout, MobileLayout } from "./grid";

export type BlockType =
  | "markdown"
  | "image"
  | "quote"
  | "spotify"
  | "apple_music"
  | "strava"
  | "map"
  | "code"
  | "weather";

export interface BaseBlock {
  id: string;
  post_id: string;
  parent_block_id: string | null;
  type: BlockType;
  grid_layout_desktop: DesktopLayout;
  grid_layout_mobile: MobileLayout;
  float_position: "left" | "right" | "center" | null;
  z_index: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MarkdownBlock extends BaseBlock {
  type: "markdown";
  content: { markdown: string };
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  content: { url: string; alt: string; caption?: string };
}

export interface SpotifyBlock extends BaseBlock {
  type: "spotify";
  content: { url: string };
}

export interface AppleMusicBlock extends BaseBlock {
  type: "apple_music";
  content: { url: string };
}

export interface StravaBlock extends BaseBlock {
  type: "strava";
  content: { url: string };
}

export interface MapBlock extends BaseBlock {
  type: "map";
  content: { lat: number; lng: number; label?: string };
}

export interface CodeBlock extends BaseBlock {
  type: "code";
  content: { code: string; language: string };
}

export interface QuoteBlock extends BaseBlock {
  type: "quote";
  content: { text: string; attribution?: string };
}

export interface WeatherBlock extends BaseBlock {
  type: "weather";
  content: { city: string };
}

export type Block =
  | MarkdownBlock
  | ImageBlock
  | QuoteBlock
  | SpotifyBlock
  | AppleMusicBlock
  | StravaBlock
  | MapBlock
  | CodeBlock
  | WeatherBlock;

export interface Post {
  id: string;
  user_id: string;
  week_number: number;
  year: number;
  title: string | null;
  is_published: boolean;
  is_late: boolean;
  word_count: number;
  cover_color: string | null;
  tags: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
  blocks?: Block[];
}
