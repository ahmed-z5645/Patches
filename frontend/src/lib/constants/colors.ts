export const COVER_COLORS = [
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
] as const;

const DARK_COLORS = new Set<string>([
  "#223843",
  "#4a7c59",
  "#6b5b95",
]);

export function isDarkColor(hex: string | null | undefined): boolean {
  if (!hex) return false;
  return DARK_COLORS.has(hex.toLowerCase());
}
