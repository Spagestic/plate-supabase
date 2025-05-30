"use client";

import * as React from "react";
import { useEffect } from "react";
import type { Value } from "@udecode/plate";

import { BasicElementsPlugin } from "@udecode/plate-basic-elements/react";
import { BasicMarksPlugin } from "@udecode/plate-basic-marks/react";
import {
  type PlateElementProps,
  type PlateLeafProps,
  Plate,
  PlateLeaf,
  usePlateEditor,
} from "@udecode/plate/react";
import { RemoteCursorOverlay } from "@/components/ui/remote-cursor-overlay";
import { YjsPlugin } from "@udecode/plate-yjs/react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { BlockquoteElement } from "@/components/ui/blockquote-element";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { HeadingElement } from "@/components/ui/heading-element";

import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button";
import { ParagraphElement } from "@/components/ui/paragraph-element";
import { ToolbarButton } from "@/components/ui/toolbar"; // Generic toolbar button
import { useMounted } from "@/hooks/use-mounted";

const initialValue: Value = [
  { type: "h3", children: [{ text: "Title" }] },
  { type: "blockquote", children: [{ text: "This is a quote." }] },
  {
    type: "p",
    children: [
      { text: "With some " },
      { text: "bold", bold: true },
      { text: " text for emphasis!" },
    ],
  },
];

// Create shared Y.Doc and Awareness instances
const ydoc = new Y.Doc();
const awareness = new Awareness(ydoc);

export default function MyEditorPage() {
  const mounted = useMounted();

  const editor = usePlateEditor({
    plugins: [
      BasicElementsPlugin,
      BasicMarksPlugin,
      YjsPlugin.configure({
        render: {
          afterEditable: RemoteCursorOverlay,
        },
        options: {
          ydoc,
          awareness,
          cursors: {
            data: {
              name: `User-${Math.floor(Math.random() * 100)}`,
              color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
            },
          },
          providers: [
            {
              type: "webrtc",
              options: {
                roomName: "my-document-id", // Must match the document identifier
                signaling: ["ws://localhost:4444"], // Optional: Your signaling server URLs
                // peerOpts: { ... } // Optional: WebRTC Peer options (e.g., for TURN servers)
              },
            },
          ], // No providers
          onConnect: ({ type }) =>
            console.log(`[YjsPlugin] Provider ${type} connected!`),
          onDisconnect: ({ type }) =>
            console.log(`[YjsPlugin] Provider ${type} disconnected.`),
          onError: ({ type, error }) =>
            console.error(`[YjsPlugin] Error in provider ${type}:`, error),
          onSyncChange: ({ type, isSynced }) =>
            console.log(
              `[YjsPlugin] Provider ${type} sync status: ${isSynced}`
            ),
        },
      }),
    ],
    value: initialValue,
    skipInitialization: true,
    components: {
      blockquote: BlockquoteElement,
      p: ParagraphElement,
      h1: (props: PlateElementProps) => (
        <HeadingElement {...props} variant="h1" />
      ),
      h2: (props: PlateElementProps) => (
        <HeadingElement {...props} variant="h2" />
      ),
      h3: (props: PlateElementProps) => (
        <HeadingElement {...props} variant="h3" />
      ),
      bold: (props: PlateLeafProps) => <PlateLeaf {...props} as="strong" />,
      italic: (props: PlateLeafProps) => <PlateLeaf {...props} as="em" />,
      underline: (props: PlateLeafProps) => <PlateLeaf {...props} as="u" />,
    },
  });

  useEffect(() => {
    // Ensure component is mounted and editor is ready
    if (!mounted) {
      console.log("[MyEditorPage] useEffect: Component not mounted yet.");
      return;
    }
    console.log("[MyEditorPage] useEffect: Component mounted, editor ready.");

    // Initialize Yjs connection, sync document, and set initial editor state
    console.log("[MyEditorPage] useEffect: Calling yjs.init().");
    editor.getApi(YjsPlugin).yjs.init({
      id: "plate-collaboration-room-1", // Unique identifier for the Yjs document, matches Supabase channel
      value: initialValue, // Initial content if the Y.Doc is empty
    });

    // Clean up: Destroy connection when component unmounts
    return () => {
      console.log("[MyEditorPage] useEffect cleanup: Calling yjs.destroy().");
      editor.getApi(YjsPlugin).yjs.destroy();
    };
  }, [editor, mounted]);

  return (
    <Plate editor={editor}>
      <FixedToolbar className="flex justify-start gap-1 rounded-t-lg">
        {/* Element Toolbar Buttons */}
        <ToolbarButton onClick={() => editor.tf.toggleBlock("h1")}>
          H1
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.tf.toggleBlock("h2")}>
          H2
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.tf.toggleBlock("h3")}>
          H3
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.tf.toggleBlock("blockquote")}>
          Quote
        </ToolbarButton>
        {/* Mark Toolbar Buttons */}
        <MarkToolbarButton nodeType="bold" tooltip="Bold (⌘+B)">
          B
        </MarkToolbarButton>
        <MarkToolbarButton nodeType="italic" tooltip="Italic (⌘+I)">
          I
        </MarkToolbarButton>
        <MarkToolbarButton nodeType="underline" tooltip="Underline (⌘+U)">
          U
        </MarkToolbarButton>
      </FixedToolbar>
      <EditorContainer>
        <Editor placeholder="Type your amazing content here..." />
      </EditorContainer>
    </Plate>
  );
}
