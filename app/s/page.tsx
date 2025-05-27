/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { useEffect, useMemo } from "react";
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
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols/awareness";
import { BlockquoteElement } from "@/components/ui/blockquote-element";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { HeadingElement } from "@/components/ui/heading-element";

import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button";
import { ParagraphElement } from "@/components/ui/paragraph-element";
import { ToolbarButton } from "@/components/ui/toolbar"; // Generic toolbar button
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/hooks/use-mounted";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

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

const SUPABASE_CHANNEL_NAME = "plate-collaboration-room-1"; // Choose a unique channel name

// Supabase Provider Implementation
class SupabaseProvider implements UnifiedProvider {
  public type = "supabase";
  public document: Y.Doc;
  public awareness: Awareness;
  private supabaseClient: SupabaseClient;
  private roomName: string;
  private channel: RealtimeChannel | null = null;
  public isConnected = false;
  public isSynced = false;
  private origin = "supabase-provider";

  constructor(
    doc: Y.Doc,
    awareness: Awareness,
    supabaseClient: SupabaseClient,
    roomName: string
  ) {
    this.document = doc;
    this.awareness = awareness;
    this.supabaseClient = supabaseClient;
    this.roomName = roomName;
    console.log(
      `[SupabaseProvider] Initialized for room: ${roomName}, clientID: ${doc.clientID}`
    );
  }

  private handleDocumentUpdate = (update: Uint8Array, origin: any) => {
    console.log(
      `[SupabaseProvider] handleDocumentUpdate - origin: ${origin}, local clientID: ${this.document.clientID}`
    );
    if (origin !== this.origin) {
      console.log(
        `[SupabaseProvider] Broadcasting document update from clientID: ${this.document.clientID}`
      );
      this.channel?.send({
        type: "broadcast",
        event: "document-update",
        payload: {
          update: Array.from(update), // Convert Uint8Array to Array for JSON
          senderId: this.document.clientID,
        },
      });
    } else {
      console.log(
        "[SupabaseProvider] Skipped broadcasting document update (origin is self)"
      );
    }
  };

  private handleAwarenessUpdate = (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: any
  ) => {
    console.log(
      `[SupabaseProvider] handleAwarenessUpdate - origin: ${origin}, local clientID: ${this.document.clientID}`
    );
    if (
      origin !== this.origin &&
      (added.length > 0 || updated.length > 0 || removed.length > 0)
    ) {
      const changedClients = added.concat(updated).concat(removed);
      const awarenessUpdate = encodeAwarenessUpdate(
        this.awareness,
        changedClients
      );
      console.log(
        `[SupabaseProvider] Broadcasting awareness update from clientID: ${this.document.clientID}`
      );
      this.channel?.send({
        type: "broadcast",
        event: "awareness-update",
        payload: {
          update: Array.from(awarenessUpdate), // Convert Uint8Array to Array for JSON
          senderId: this.document.clientID,
        },
      });
    } else {
      console.log(
        "[SupabaseProvider] Skipped broadcasting awareness update (origin is self or no changes)"
      );
    }
  };

  connect = () => {
    if (this.isConnected) {
      console.log("[SupabaseProvider] connect: Already connected.");
      return;
    }
    console.log(`[SupabaseProvider] Connecting to room: ${this.roomName}`);

    this.channel = this.supabaseClient.channel(this.roomName, {
      config: { broadcast: { ack: true } },
    });

    this.channel
      .on("broadcast", { event: "document-update" }, ({ payload }) => {
        console.log(
          `[SupabaseProvider] Received document-update broadcast. Sender: ${payload.senderId}, Local ClientID: ${this.document.clientID}`
        );
        if (payload.senderId !== this.document.clientID) {
          console.log("[SupabaseProvider] Applying remote document update.");
          Y.applyUpdate(
            this.document,
            new Uint8Array(payload.update),
            this.origin
          );
        } else {
          console.log(
            "[SupabaseProvider] Ignored own document-update broadcast."
          );
        }
      })
      .on("broadcast", { event: "awareness-update" }, ({ payload }) => {
        console.log(
          `[SupabaseProvider] Received awareness-update broadcast. Sender: ${payload.senderId}, Local ClientID: ${this.document.clientID}`
        );
        if (payload.senderId !== this.document.clientID) {
          console.log("[SupabaseProvider] Applying remote awareness update.");
          applyAwarenessUpdate(
            this.awareness,
            new Uint8Array(payload.update),
            this.origin
          );
        } else {
          console.log(
            "[SupabaseProvider] Ignored own awareness-update broadcast."
          );
        }
      })
      .subscribe((status) => {
        console.log(`[SupabaseProvider] Subscription status: ${status}`);
        if (status === "SUBSCRIBED") {
          this.isConnected = true;
          this.isSynced = true; // Assume synced once connected for broadcast
          console.log(
            "[SupabaseProvider] SUBSCRIBED. Attaching event listeners."
          );
          this.document.on("update", this.handleDocumentUpdate);
          this.awareness.on("update", this.handleAwarenessUpdate);
          // Broadcast initial awareness state
          const awarenessUpdate = encodeAwarenessUpdate(this.awareness, [
            this.document.clientID,
          ]);
          console.log(
            "[SupabaseProvider] Sending initial awareness state on subscribe."
          );
          this.channel?.send({
            type: "broadcast",
            event: "awareness-update",
            payload: {
              update: Array.from(awarenessUpdate),
              senderId: this.document.clientID,
            },
          });
        } else {
          console.log(
            `[SupabaseProvider] Status not SUBSCRIBED: ${status}. Setting isConnected/isSynced to false.`
          );
          this.isConnected = false;
          this.isSynced = false;
        }
      });
  };

  disconnect = () => {
    console.log("[SupabaseProvider] disconnect called.");
    this.document.off("update", this.handleDocumentUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.channel?.unsubscribe();
    this.isConnected = false;
    this.isSynced = false;
    this.channel = null;
    console.log("[SupabaseProvider] Disconnected.");
  };

  destroy = () => {
    console.log("[SupabaseProvider] destroy called.");
    this.disconnect();
  };
}

// Create shared Y.Doc and Awareness instances
// These should be stable across re-renders of MyEditorPage
// or managed by a higher-level state solution if MyEditorPage can remount with different documents.
const ydoc = new Y.Doc();
const awareness = new Awareness(ydoc);

export default function MyEditorPage() {
  const supabase = createClient();
  const mounted = useMounted();

  const supabaseProvider = useMemo(() => {
    console.log("[MyEditorPage] Creating SupabaseProvider instance.");
    return new SupabaseProvider(
      ydoc,
      awareness,
      supabase,
      SUPABASE_CHANNEL_NAME
    );
  }, [supabase]);

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
          // Pass the shared ydoc and awareness
          ydoc,
          awareness,
          // Configure local user cursor appearance
          cursors: {
            data: {
              name: `User-${Math.floor(Math.random() * 100)}`, // Replace with dynamic user name
              color: `#${Math.floor(Math.random() * 16777215).toString(16)}`, // Replace with dynamic user color
            },
            // autoSend: true, // Default is true, explicitly setting for clarity
          },
          // Configure providers. All providers share the same Y.Doc and Awareness instance.
          providers: [
            supabaseProvider, // Use the SupabaseProvider instance
          ],
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
    ], // Add plugins
    value: initialValue, // This is Plate's initial value, YjsPlugin.init will handle Y.Doc
    // Important: Skip Plate's default initialization when using Yjs
    skipInitialization: true, // YjsPlugin.init will handle this
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
    if (!mounted) {
      console.log("[MyEditorPage] useEffect: Component not mounted yet.");
      return;
    }
    console.log("[MyEditorPage] useEffect: Component mounted, editor ready.");

    // Initialize Yjs connection, sync document, and set initial editor state
    console.log("[MyEditorPage] useEffect: Calling yjs.init().");
    editor.getApi(YjsPlugin).yjs.init({
      id: SUPABASE_CHANNEL_NAME, // Unique identifier for the Yjs document, matches Supabase channel
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
