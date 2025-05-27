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

type WebRTCProviderConfig = {
  type: "webrtc";
  options: {
    // WebRTCProviderOptions
    roomName: string; // Room name for collaboration (must match other clients)
    signaling?: string[]; // Optional signaling server URLs (defaults to public servers)
    password?: string; // Optional room password
    maxConns?: number; // Max WebRTC connections
    filterBcConns?: boolean; // Filter broadcast connections
    peerOpts?: Record<string, unknown>; // Options passed to simple-peer (e.g., for ICE/TURN servers)
  };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface UnifiedProvider {
  awareness: Awareness; // Must use the shared Awareness instance
  document: Y.Doc; // Must use the shared Y.Doc instance
  type: string; // Unique type identifier (e.g., 'indexeddb')
  connect: () => void; // Logic to establish connection/load data
  destroy: () => void; // Cleanup logic (called by editor.api.yjs.destroy)
  disconnect: () => void; // Logic to disconnect/save data
  isConnected: boolean; // Provider's connection status
  isSynced: boolean; // Provider's data sync status
}

export default function MyEditorPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const supabase = createClient();
  const mounted = useMounted();
  // WebRTCProviderConfig
  const webRTCProvider: WebRTCProviderConfig = {
    type: "webrtc",
    options: {
      roomName: "my-document-id", // Unique identifier for the document
      signaling: ["ws://localhost:4444"], // Optional signaling server URLs
      // password: "your-password", // Optional room password
      maxConns: 10, // Max WebRTC connections
      filterBcConns: true, // Filter broadcast connections
      peerOpts: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }, // STUN server for NAT traversal
    },
  };

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
            // Use the webRTCProvider config
            webRTCProvider,
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
