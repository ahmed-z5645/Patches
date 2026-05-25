import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Block, Post } from "@/lib/types/blocks";
import { MOBILE_HIDDEN_LAYOUT } from "@/lib/types/grid";

// jsdom has no ResizeObserver — PrepublishScreen wires one up to measure the
// preview grid. Stub it before importing the component.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error injecting into the global for jsdom
globalThis.ResizeObserver = MockResizeObserver;

// EditorCanvas imports a Supabase client at module load. Keep it inert so
// importing PrepublishScreen (which re-exports DEFAULT_MOBILE_LAYOUTS from it)
// doesn't try to network or read env that isn't there.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

// BlockRenderer pulls in tiptap/markdown which doesn't run in jsdom — render a
// trivial placeholder we can assert on.
vi.mock("@/components/blocks/BlockRenderer", () => ({
  BlockRenderer: ({ block }: { block: Block }) => (
    <div data-testid={`renderer-${block.id}`}>{block.type}</div>
  ),
}));

// PostCard renders inside the publish form; we don't need its internals.
vi.mock("@/components/feed/PostCard", () => ({
  PostCard: ({ post }: { post: { cover_color: string | null; title: string | null } }) => (
    <div data-testid="post-card" data-cover={post.cover_color || ""}>{post.title}</div>
  ),
}));

import { PrepublishScreen } from "../PrepublishScreen";
import { COVER_COLORS } from "@/lib/constants/colors";

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    user_id: "user-1",
    week_number: 12,
    year: 2026,
    title: "My Post",
    is_published: false,
    is_late: false,
    word_count: 0,
    cover_color: null,
    tags: [],
    published_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: "block-1",
    post_id: "post-1",
    parent_block_id: null,
    type: "markdown",
    content: { markdown: "" },
    grid_layout_desktop: { colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 2 },
    grid_layout_mobile: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
    float_position: null,
    z_index: 0,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Block;
}

interface RenderOpts {
  post?: Post;
  blocks?: Block[];
  username?: string;
}

function renderScreen(opts: RenderOpts = {}) {
  const onPublish = vi.fn();
  const onSaveDraft = vi.fn();
  const onCancel = vi.fn();
  const onMobileLayoutChange = vi.fn();
  const utils = render(
    <PrepublishScreen
      post={opts.post ?? makePost()}
      blocks={opts.blocks ?? []}
      username={opts.username ?? "ahmed"}
      onPublish={onPublish}
      onSaveDraft={onSaveDraft}
      onCancel={onCancel}
      onMobileLayoutChange={onMobileLayoutChange}
    />
  );
  return { ...utils, onPublish, onSaveDraft, onCancel, onMobileLayoutChange };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PrepublishScreen", () => {
  describe("mount reset", () => {
    it("resets every top-level block to the hidden mobile layout on mount", () => {
      const blocks = [
        makeBlock({ id: "b1" }),
        makeBlock({
          id: "b2",
          type: "image",
          content: { url: "x" },
          grid_layout_mobile: { colStart: 2, colSpan: 1, rowStart: 3, rowSpan: 2 },
        }),
      ];
      const { onMobileLayoutChange } = renderScreen({ blocks });
      expect(onMobileLayoutChange).toHaveBeenCalledWith("b1", MOBILE_HIDDEN_LAYOUT);
      expect(onMobileLayoutChange).toHaveBeenCalledWith("b2", MOBILE_HIDDEN_LAYOUT);
      expect(onMobileLayoutChange).toHaveBeenCalledTimes(2);
    });

    it("skips blocks already marked hidden", () => {
      const blocks = [
        makeBlock({ id: "b1", grid_layout_mobile: MOBILE_HIDDEN_LAYOUT }),
        makeBlock({ id: "b2" }),
      ];
      const { onMobileLayoutChange } = renderScreen({ blocks });
      expect(onMobileLayoutChange).toHaveBeenCalledTimes(1);
      expect(onMobileLayoutChange).toHaveBeenCalledWith("b2", MOBILE_HIDDEN_LAYOUT);
    });

    it("skips child blocks (those with parent_block_id)", () => {
      const blocks = [
        makeBlock({ id: "parent" }),
        makeBlock({
          id: "child",
          parent_block_id: "parent",
          grid_layout_mobile: { colStart: 1, colSpan: 1, rowStart: 5, rowSpan: 2 },
        }),
      ];
      const { onMobileLayoutChange } = renderScreen({ blocks });
      expect(onMobileLayoutChange).toHaveBeenCalledTimes(1);
      expect(onMobileLayoutChange).toHaveBeenCalledWith("parent", MOBILE_HIDDEN_LAYOUT);
    });

    it("only resets once even if parent re-renders with new block array", () => {
      const blocks = [makeBlock({ id: "b1" })];
      const { rerender, onMobileLayoutChange } = renderScreen({ blocks });
      expect(onMobileLayoutChange).toHaveBeenCalledTimes(1);

      rerender(
        <PrepublishScreen
          post={makePost()}
          blocks={[makeBlock({ id: "b1" }), makeBlock({ id: "b2" })]}
          username="ahmed"
          onPublish={vi.fn()}
          onSaveDraft={vi.fn()}
          onCancel={vi.fn()}
          onMobileLayoutChange={onMobileLayoutChange}
        />
      );
      // didResetRef guards a second reset pass
      expect(onMobileLayoutChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("palette vs. phone derivation", () => {
    it("puts hidden-layout blocks in the palette", () => {
      const blocks = [
        makeBlock({ id: "b1", grid_layout_mobile: MOBILE_HIDDEN_LAYOUT }),
        makeBlock({ id: "b2", type: "image", content: { url: "x" }, grid_layout_mobile: MOBILE_HIDDEN_LAYOUT }),
      ];
      renderScreen({ blocks });
      expect(screen.getByText("Blocks (2)")).toBeInTheDocument();
      expect(screen.getByTestId("renderer-b1")).toBeInTheDocument();
      expect(screen.getByTestId("renderer-b2")).toBeInTheDocument();
      // Phone empty-state message renders when nothing is placed
      expect(screen.getByText(/drag blocks here/i)).toBeInTheDocument();
    });

    it("puts placed blocks in the phone and shows the empty-palette message when palette is empty", () => {
      const blocks = [
        makeBlock({
          id: "b1",
          grid_layout_mobile: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
        }),
      ];
      renderScreen({ blocks });
      expect(screen.getByText("Blocks (0)")).toBeInTheDocument();
      expect(screen.getByText(/all blocks placed/i)).toBeInTheDocument();
      // Tile renders inside the phone grid
      expect(screen.getByTestId("renderer-b1")).toBeInTheDocument();
      // No empty-phone hint when at least one tile is placed
      expect(screen.queryByText(/drag blocks here/i)).not.toBeInTheDocument();
    });

    it("does not show child blocks in the palette", () => {
      const blocks = [
        makeBlock({ id: "parent", grid_layout_mobile: MOBILE_HIDDEN_LAYOUT }),
        makeBlock({
          id: "child",
          parent_block_id: "parent",
          grid_layout_mobile: MOBILE_HIDDEN_LAYOUT,
        }),
      ];
      renderScreen({ blocks });
      // Only the parent counts toward the palette
      expect(screen.getByText("Blocks (1)")).toBeInTheDocument();
      expect(screen.queryByTestId("renderer-child")).not.toBeInTheDocument();
    });
  });

  describe("phone metadata", () => {
    it("renders real username, week, year, and computed reading time", () => {
      const blocks = [
        makeBlock({
          id: "b1",
          grid_layout_mobile: MOBILE_HIDDEN_LAYOUT,
          // 600 words ≈ 3 minutes at 200 wpm
          content: { markdown: Array(600).fill("word").join(" ") },
        }),
      ];
      renderScreen({
        post: makePost({ week_number: 8, year: 2025 }),
        blocks,
        username: "ahmed",
      });
      expect(screen.getByText("ahmed's page")).toBeInTheDocument();
      expect(screen.getByText(/@ahmed/)).toBeInTheDocument();
      expect(screen.getByText(/Week 8, 2025/)).toBeInTheDocument();
      expect(screen.getByText(/3 min read/)).toBeInTheDocument();
    });

    it("falls back to a 1-minute reading time when there is no markdown content", () => {
      renderScreen({ blocks: [] });
      expect(screen.getByText(/1 min read/)).toBeInTheDocument();
    });

    it("excludes child markdown blocks from the reading-time calculation", () => {
      const blocks = [
        makeBlock({
          id: "parent",
          grid_layout_mobile: MOBILE_HIDDEN_LAYOUT,
          content: { markdown: "" },
        }),
        makeBlock({
          id: "nested",
          parent_block_id: "parent",
          // 1000 words would otherwise push reading time to 5 min
          content: { markdown: Array(1000).fill("word").join(" ") },
        }),
      ];
      renderScreen({ blocks });
      expect(screen.getByText(/1 min read/)).toBeInTheDocument();
    });

    it("falls back to a friendly handle when username is empty", () => {
      renderScreen({ username: "" });
      expect(screen.getByText("Patches")).toBeInTheDocument();
      // The meta line shows just "you · Week N, YYYY · X min read" when there's no username
      expect(screen.getByText(/^you · Week/)).toBeInTheDocument();
    });

    it("uses the post title in the phone preview header", () => {
      renderScreen({ post: makePost({ title: "A Specific Title" }) });
      // Title appears in the phone preview AND inside the PostCard mock
      const titles = screen.getAllByText("A Specific Title");
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    it("shows Untitled in the phone when the post has no title", () => {
      renderScreen({ post: makePost({ title: null }) });
      expect(screen.getByText("Untitled")).toBeInTheDocument();
    });
  });

  describe("tags", () => {
    it("adds a tag on Enter and clears the input", async () => {
      const user = userEvent.setup();
      renderScreen();
      const input = screen.getByPlaceholderText(/travel, cooking/i);
      await user.type(input, "books{Enter}");
      expect(screen.getByText("#books")).toBeInTheDocument();
      expect(input).toHaveValue("");
    });

    it("lowercases and trims tags", async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(screen.getByPlaceholderText(/travel, cooking/i), "  Coffee  {Enter}");
      expect(screen.getByText("#coffee")).toBeInTheDocument();
    });

    it("rejects empty tags", async () => {
      const user = userEvent.setup();
      renderScreen();
      const input = screen.getByPlaceholderText(/travel, cooking/i);
      await user.type(input, "   {Enter}");
      // No tag rendered; placeholder still says "travel, cooking..."
      expect(input).toBeInTheDocument();
      expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
    });

    it("rejects duplicate tags", async () => {
      const user = userEvent.setup();
      renderScreen();
      const input = screen.getByPlaceholderText(/travel, cooking/i);
      await user.type(input, "music{Enter}");
      await user.type(input, "music{Enter}");
      expect(screen.getAllByText("#music")).toHaveLength(1);
    });

    it("caps tags at 3 and hides the input once full", async () => {
      const user = userEvent.setup();
      renderScreen();
      let input: HTMLElement | null = screen.getByPlaceholderText(/travel, cooking/i);
      await user.type(input, "one{Enter}");
      input = screen.getByPlaceholderText(/add another/i);
      await user.type(input, "two{Enter}");
      input = screen.getByPlaceholderText(/add another/i);
      await user.type(input, "three{Enter}");
      expect(screen.getByText("#one")).toBeInTheDocument();
      expect(screen.getByText("#two")).toBeInTheDocument();
      expect(screen.getByText("#three")).toBeInTheDocument();
      // Input disappears once we hit the 3-tag cap
      expect(screen.queryByPlaceholderText(/add another/i)).not.toBeInTheDocument();
    });

    it("removes a tag when its × is clicked and reopens the input", async () => {
      const user = userEvent.setup();
      renderScreen();
      let input: HTMLElement | null = screen.getByPlaceholderText(/travel, cooking/i);
      await user.type(input, "a{Enter}");
      await user.type(screen.getByPlaceholderText(/add another/i), "b{Enter}");
      await user.type(screen.getByPlaceholderText(/add another/i), "c{Enter}");
      expect(screen.queryByPlaceholderText(/add another/i)).not.toBeInTheDocument();

      const removeOnA = within(screen.getByText("#a").closest("span")!).getByRole("button");
      await user.click(removeOnA);
      expect(screen.queryByText("#a")).not.toBeInTheDocument();
      // Input reappears now that we're back under the cap
      input = screen.getByPlaceholderText(/add another/i);
      expect(input).toBeInTheDocument();
    });
  });

  describe("cover color", () => {
    it("initializes from post.cover_color when present", () => {
      renderScreen({ post: makePost({ cover_color: COVER_COLORS[3] }) });
      const card = screen.getByTestId("post-card");
      expect(card).toHaveAttribute("data-cover", COVER_COLORS[3]);
    });

    it("falls back to the first cover color when post has none", () => {
      renderScreen({ post: makePost({ cover_color: null }) });
      const card = screen.getByTestId("post-card");
      expect(card).toHaveAttribute("data-cover", COVER_COLORS[0]);
    });

    it("updates the preview when a different swatch is clicked", async () => {
      const user = userEvent.setup();
      const { container } = renderScreen({ post: makePost({ cover_color: COVER_COLORS[0] }) });
      // Swatches are buttons with size-7 + an inline backgroundColor — find by
      // computed style (jsdom returns colors in rgb form, so normalize via the
      // browser's parser).
      const swatchProbe = document.createElement("div");
      swatchProbe.style.backgroundColor = COVER_COLORS[5];
      const targetRgb = swatchProbe.style.backgroundColor;
      const swatch = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button.size-7")
      ).find((b) => b.style.backgroundColor === targetRgb);
      expect(swatch).toBeDefined();
      await user.click(swatch!);
      expect(screen.getByTestId("post-card")).toHaveAttribute("data-cover", COVER_COLORS[5]);
    });
  });

  describe("publish / draft / cancel", () => {
    // The handlers each setTimeout for ~300ms to let the exit animation play
    // before firing the callback. Use real timers + waitFor so userEvent's
    // own scheduling stays sane.
    it("calls onPublish with the selected cover color and current tags", async () => {
      const user = userEvent.setup();
      const { onPublish } = renderScreen({
        post: makePost({ cover_color: COVER_COLORS[2] }),
      });
      await user.type(screen.getByPlaceholderText(/travel, cooking/i), "alpha{Enter}");
      await user.click(screen.getByRole("button", { name: /PUBLISH/i }));
      await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
      expect(onPublish).toHaveBeenCalledWith(COVER_COLORS[2], ["alpha"]);
    });

    it("calls onSaveDraft after the exit animation", async () => {
      const user = userEvent.setup();
      const { onSaveDraft } = renderScreen();
      await user.click(screen.getByRole("button", { name: /save as draft/i }));
      await waitFor(() => expect(onSaveDraft).toHaveBeenCalledOnce());
    });

    it("calls onCancel when the back button is clicked", async () => {
      const user = userEvent.setup();
      const { onCancel } = renderScreen();
      await user.click(screen.getByRole("button", { name: /back to editor/i }));
      await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
    });
  });

  describe("remove from phone", () => {
    it("sends the block back to the palette by writing MOBILE_HIDDEN_LAYOUT", async () => {
      const user = userEvent.setup();
      const blocks = [
        makeBlock({
          id: "placed-1",
          grid_layout_mobile: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 2 },
        }),
      ];
      const { onMobileLayoutChange } = renderScreen({ blocks });
      // Mount-reset call fires first; ignore it, then click the × button.
      onMobileLayoutChange.mockClear();
      const removeBtn = screen.getByRole("button", { name: /remove from mobile layout/i });
      await user.click(removeBtn);
      expect(onMobileLayoutChange).toHaveBeenCalledWith("placed-1", MOBILE_HIDDEN_LAYOUT);
    });
  });
});
