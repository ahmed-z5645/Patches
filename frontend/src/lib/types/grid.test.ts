import { describe, expect, it } from "vitest";

import { MOBILE_HIDDEN_LAYOUT, isMobileHidden, type MobileLayout } from "@/lib/types/grid";

describe("isMobileHidden", () => {
  it("returns true for the canonical sentinel", () => {
    expect(isMobileHidden(MOBILE_HIDDEN_LAYOUT)).toBe(true);
  });

  it("returns true for any layout with colStart === 0 (the marker)", () => {
    const layout: MobileLayout = { colStart: 0, colSpan: 1, rowStart: 1, rowSpan: 2 };
    expect(isMobileHidden(layout)).toBe(true);
  });

  it("returns false for a normally placed mobile tile", () => {
    const layout: MobileLayout = { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 };
    expect(isMobileHidden(layout)).toBe(false);
  });

  it("returns false for colStart === 2 (right column)", () => {
    const layout: MobileLayout = { colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 2 };
    expect(isMobileHidden(layout)).toBe(false);
  });
});

describe("MOBILE_HIDDEN_LAYOUT sentinel shape", () => {
  it("uses zeros for every coordinate so renderers can pattern-match", () => {
    expect(MOBILE_HIDDEN_LAYOUT).toEqual({
      colStart: 0,
      colSpan: 0,
      rowStart: 0,
      rowSpan: 0,
    });
  });
});
