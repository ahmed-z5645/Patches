"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { marked } from "marked";
import TurndownService from "turndown";
import type {
  MarkdownBlock as MarkdownBlockType,
  Block,
} from "@/lib/types/blocks";
import { BlockRenderer } from "./BlockRenderer";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

interface MarkdownBlockProps {
  block: MarkdownBlockType;
  childBlocks?: Block[];
  isEditing?: boolean;
  onUpdate?: (content: { markdown: string }) => void;
}

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex size-7 items-center justify-center rounded text-xs font-bold transition-colors ${
        active ? "bg-white text-text" : "text-white/80 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function MarkdownBlock({
  block,
  childBlocks = [],
  isEditing,
  onUpdate,
}: MarkdownBlockProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    content: markdownToHtml(block.content.markdown),
    editable: isEditing,
    immediatelyRender: true,
    onUpdate: ({ editor }) => {
      const md = htmlToMarkdown(editor.getHTML());
      onUpdate?.({ markdown: md });
    },
    editorProps: {
      attributes: {
        class: "outline-none prose prose-sm max-w-none",
      },
    },
  });

  if (isEditing && editor) {
    return (
      <div className="relative h-full p-4">
        {childBlocks.map((child) => (
          <div
            key={child.id}
            className={`my-2 ${
              child.float_position === "left"
                ? "float-left mr-4 w-2/5"
                : child.float_position === "right"
                  ? "float-right ml-4 w-2/5"
                  : "mx-auto w-3/5"
            }`}
          >
            <BlockRenderer block={child} isEditing={isEditing} />
          </div>
        ))}

        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 rounded-[10px] bg-text px-1.5 py-1 shadow-lg"
        >
          <ToolbarButton
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            H3
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-white/20" />

          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <span className="line-through">S</span>
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-white/20" />

          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            •
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1.
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            &ldquo;
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            {"<>"}
          </ToolbarButton>
        </BubbleMenu>

        <EditorContent editor={editor} className="text-md" />
      </div>
    );
  }

  return (
    <div className="prose prose-sm h-full max-w-none p-4">
      {childBlocks.map((child) => (
        <div
          key={child.id}
          className={`my-2 ${
            child.float_position === "left"
              ? "float-left mr-4 w-2/5"
              : child.float_position === "right"
                ? "float-right ml-4 w-2/5"
                : "mx-auto w-3/5"
          }`}
        >
          <BlockRenderer block={child} />
        </div>
      ))}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {block.content.markdown}
      </ReactMarkdown>
    </div>
  );
}
