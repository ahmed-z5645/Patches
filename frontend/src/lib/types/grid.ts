export interface DesktopLayout {
  colStart: number;
  colSpan: number;
  rowStart: number;
  rowSpan: number;
}

export interface MobileLayout {
  colStart: number;
  colSpan: number;
  rowStart: number;
  rowSpan: number;
}

// Sentinel layout meaning "not placed on mobile / hidden on mobile."
// colStart === 0 is impossible in the live 1-indexed grid, so we use it as
// the marker. The prepublish palette flow resets every block to this value
// on entry; mobile renderers filter blocks matching it out.
export const MOBILE_HIDDEN_LAYOUT: MobileLayout = {
  colStart: 0,
  colSpan: 0,
  rowStart: 0,
  rowSpan: 0,
};

export function isMobileHidden(layout: MobileLayout): boolean {
  return layout.colStart === 0;
}
