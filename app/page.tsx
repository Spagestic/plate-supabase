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
import { BlockquoteElement } from "@/components/ui/blockquote-element";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { HeadingElement } from "@/components/ui/heading-element";
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button";
import { ParagraphElement } from "@/components/ui/paragraph-element";
import { ToolbarButton } from "@/components/ui/toolbar"; // Generic toolbar button
import { createClient } from "@/lib/supabase/client";
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

export default function MyEditorPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const supabase = createClient();
  const mounted = useMounted();
  const editor = usePlateEditor({
    plugins: [
      BasicElementsPlugin,
      BasicMarksPlugin,
      YjsPlugin.configure({
        // Render remote cursors using the overlay component
        render: {
          afterEditable: RemoteCursorOverlay,
        },
        // Yjs Plugin Options
        options: {
          // Configure local user cursor appearance
          cursors: {
            data: {
              name: "User Name", // Replace with dynamic user name
              color: "#aabbcc", // Replace with dynamic user color
            },
          },

          // Configure providers. All providers share the same Y.Doc and Awareness instance.
          providers: [
            // Example: WebRTC provider (can be used alongside Hocuspocus)
            {
              type: "webrtc",
              options: {
                roomName: "my-document-id", // Must match the document identifier
                signaling: ["ws://localhost:4444"], // Optional: Your signaling server URLs
                // peerOpts: { ... } // Optional: WebRTC Peer options (e.g., for TURN servers)
              },
            },
          ],
        },
      }),
    ], // Add plugins
    value: initialValue,
    components: {
      // Element components
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
      // Mark components (from previous step)
      bold: (props: PlateLeafProps) => <PlateLeaf {...props} as="strong" />,
      italic: (props: PlateLeafProps) => <PlateLeaf {...props} as="em" />,
      underline: (props: PlateLeafProps) => <PlateLeaf {...props} as="u" />,
    },
  });

  useEffect(() => {
    // Ensure component is mounted and editor is ready
    if (!mounted) return;

    // Initialize Yjs connection, sync document, and set initial editor state
    editor.getApi(YjsPlugin).yjs.init({
      id: "1", // Unique identifier for the Yjs document
      value: initialValue, // Initial content if the Y.Doc is empty
    });

    // Clean up: Destroy connection when component unmounts
    return () => {
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
