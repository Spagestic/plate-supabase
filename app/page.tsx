"use client";

import * as React from "react";
import { useEffect } from "react";
import type { Value } from "@udecode/plate";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

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
import { ToolbarButton } from "@/components/ui/toolbar";
import { SupabaseProvider } from "@/lib/providers/unified-providers";
import { useMounted } from "@/hooks/use-mounted"; // use actual mount detection
import { CollaborationDebug } from "@/components/ui/collaboration-debug";
import { CursorDebug } from "@/components/ui/cursor-debug";

const initialValue: Value = [
  { type: "h3", children: [{ text: "Title" }] },
  { type: "blockquote", children: [{ text: "This is a quote." }] },
  {
    type: "p",
    children: [
      { text: "Please note that this is a " },
      { text: "temporary", bold: true },
      { text: " editor!" },
    ],
  },
  {
    type: "p",
    children: [{ text: "Changes will not be saved here." }],
  },
];

export default function TeporaryPlateEditorPage() {
  const mounted = useMounted();

  // collaboration state: unique per component instance
  const documentId = React.useMemo(
    () => "5eb6f176-fc34-45a8-bdca-abf08a9118f5",
    []
  );
  const username = React.useMemo(
    () => `User-${Math.floor(Math.random() * 100)}`,
    []
  );
  const channelName = React.useMemo(
    () => `temp-plate-editor-${documentId}`,
    [documentId]
  );
  const userColor = React.useMemo(
    () =>
      `#${Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0")}`,
    []
  );
  const ydoc = React.useMemo(() => new Y.Doc(), []);
  const awareness = React.useMemo(() => new Awareness(ydoc), [ydoc]);
  const onConnect = React.useCallback(
    () => console.log("[SupabaseProvider] Connected!"),
    []
  );
  const onDisconnect = React.useCallback(
    () => console.log("[SupabaseProvider] Disconnected."),
    []
  );
  const onError = React.useCallback(
    (err: Error) => console.error("[SupabaseProvider] Error:", err),
    []
  );
  const onSyncChange = React.useCallback(
    (synced: boolean) => console.log("[SupabaseProvider] Sync status:", synced),
    []
  );
  const supabaseProvider = React.useMemo(
    () =>
      new SupabaseProvider(ydoc, awareness, channelName, username, documentId, {
        onConnect,
        onDisconnect,
        onError,
        onSyncChange,
      }),
    [
      ydoc,
      awareness,
      channelName,
      username,
      documentId,
      onConnect,
      onDisconnect,
      onError,
      onSyncChange,
    ]
  );

  // Add a simple effect to debug the mounting process
  useEffect(() => {
    if (mounted) console.log("🔍 Component mounted");
  }, [mounted]);

  // Add a basic effect without dependencies
  useEffect(() => {
    console.log("✅ Basic useEffect running (no deps)");
  }, []);

  const editor = usePlateEditor({
    plugins: [
      BasicElementsPlugin,
      BasicMarksPlugin,
      YjsPlugin.configure({
        render: {
          afterEditable: RemoteCursorOverlay,
        },
        options: {
          // Provide our own Y.Doc and Awareness instances
          ydoc: ydoc,
          awareness: awareness,
          cursors: {
            data: {
              name: username,
              color: userColor,
            },
          },
          // Pass our custom provider instance
          providers: [supabaseProvider],
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
    if (!mounted || !editor) return;
    // initialize awareness and connect
    awareness.setLocalStateField("data", { name: username, color: userColor });
    supabaseProvider.connect();
    editor.getApi(YjsPlugin).yjs.init({ id: documentId, value: initialValue });
    // periodic sync check and debug intervals
    const syncInterval = setInterval(() => {
      if (supabaseProvider.isSynced) {
        editor.setOption(YjsPlugin, "_isSynced", true);
        editor
          .getPlugin(YjsPlugin)
          ?.options.onSyncChange?.({ type: "supabase", isSynced: true });
      }
    }, 500);
    const debugInterval = setInterval(() => {
      const awarenessStates = Array.from(awareness.getStates().entries());
      const remoteStates = awarenessStates.filter(
        ([clientId]) => clientId !== awareness.clientID
      );

      console.log("🔄 Awareness states update:", {
        localClientId: awareness.clientID,
        totalStates: awarenessStates.length,
        localState: awareness.getLocalState(),
        remoteCount: remoteStates.length,
        remoteClients: remoteStates.map(([clientId]) => clientId),
        yjsPluginSynced: editor.getOption(YjsPlugin, "_isSynced"),
        supabaseSynced: supabaseProvider.isSynced,
      });

      // Check for critical data fields needed for cursor rendering
      const yjsPlugin = editor.getPlugin(YjsPlugin);
      const selectionStateField =
        yjsPlugin?.options.cursors?.cursorStateField || "selection";
      const cursorDataField =
        yjsPlugin?.options.cursors?.cursorDataField || "data";

      console.log("🔍 Cursor fields check:", {
        selectionStateField,
        cursorDataField,
        hasCursorConfig: !!yjsPlugin?.options.cursors,
        hasSelectionInLocalState:
          !!awareness.getLocalState()?.[selectionStateField],
        hasCursorDataInLocalState:
          !!awareness.getLocalState()?.[cursorDataField],
      });
    }, 5000);
    return () => {
      clearInterval(syncInterval);
      clearInterval(debugInterval);
      editor.getApi(YjsPlugin).yjs.destroy();
      supabaseProvider.destroy();
    };
  }, [
    editor,
    mounted,
    awareness,
    supabaseProvider,
    username,
    userColor,
    documentId,
  ]);

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
      <EditorContainer className="relative">
        <Editor placeholder="Type your amazing content here..." />
      </EditorContainer>
      <CollaborationDebug
        provider={supabaseProvider}
        ydoc={ydoc}
        awareness={awareness}
      />
      <CursorDebug awareness={awareness} />
    </Plate>
  );
}
