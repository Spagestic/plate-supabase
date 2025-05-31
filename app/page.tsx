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
import { PlateCursorWrapper } from "@/components/ui/plate-cursor-wrapper";

import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button";
import { ParagraphElement } from "@/components/ui/paragraph-element";
import { ToolbarButton } from "@/components/ui/toolbar";
// import { useMounted } from "@/hooks/use-mounted"; // Temporarily commented out
import { SupabaseProvider } from "@/lib/providers/unified-providers";
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

// Example: Instantiate your SupabaseProvider
// You'll need to provide actual values for channelName, username, and documentId
const documentId = "5eb6f176-fc34-45a8-bdca-abf08a9118f5"; // Or get this dynamically
const username = `User-${Math.floor(Math.random() * 100)}`; // Or get this from auth
const channelName = `temp-plate-editor-${documentId}`;

// Generate a consistent color for this user session
const userColor = `#${Math.floor(Math.random() * 16777215)
  .toString(16)
  .padStart(6, "0")}`;

// Create Y.Doc and Awareness instances that we'll share between YjsPlugin and our custom provider
const ydoc = new Y.Doc();
const awareness = new Awareness(ydoc);

// Create callback functions for the provider
const onConnect = () => console.log(`[SupabaseProvider] Connected!`);
const onDisconnect = () => console.log(`[SupabaseProvider] Disconnected.`);
const onError = (error: Error) =>
  console.error(`[SupabaseProvider] Error:`, error);
const onSyncChange = (isSynced: boolean) => {
  console.log(`[SupabaseProvider] Sync status: ${isSynced}`);
  // This is the key - when SupabaseProvider becomes synced, YjsPlugin should know
};

// Create our custom SupabaseProvider with the shared instances and callbacks
const supabaseProvider = new SupabaseProvider(
  ydoc,
  awareness,
  channelName,
  username,
  documentId,
  {
    onConnect,
    onDisconnect,
    onError,
    onSyncChange,
  }
);

export default function TeporaryPlateEditorPage() {
  console.log("🎯 Component rendering...");
  // const mounted = useMounted();
  const [mounted] = React.useState(true); // Temporary fix to test useEffect
  console.log("🎯 Mounted state:", mounted);
  // Add a simple effect to debug the mounting process
  useEffect(() => {
    try {
      console.log("🔍 Simple useEffect running, mounted:", mounted);
    } catch (error) {
      console.error("❌ Error in simple useEffect:", error);
    }
  }, [mounted]);

  // Add a basic effect without dependencies
  useEffect(() => {
    try {
      console.log("✅ Basic useEffect running (no deps)");
    } catch (error) {
      console.error("❌ Error in basic useEffect:", error);
    }
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
    console.log("🔧 useEffect running! Editor ready:", !!editor);

    if (!editor) {
      console.log("❌ Editor not ready yet, skipping provider connection");
      return;
    }

    console.log("🔧 Manually connecting SupabaseProvider...");
    console.log("Provider instance:", supabaseProvider);
    console.log("Provider type:", supabaseProvider.type);
    console.log("Provider connected:", supabaseProvider.isConnected);

    // Set up awareness with cursor data BEFORE connecting
    awareness.setLocalStateField("data", {
      name: username,
      color: userColor,
    });

    // Connect the provider
    supabaseProvider.connect();
    console.log(
      "Provider connected after connect():",
      supabaseProvider.isConnected
    );

    // Initialize editor regardless of mounted state for testing
    console.log("[MyEditorPage] useEffect: Calling yjs.init().");
    editor.getApi(YjsPlugin).yjs.init({
      id: documentId, // Use the same documentId
      value: initialValue, // Initial content if the Y.Doc is empty
    });

    // Force YjsPlugin to recognize the provider as synced when SupabaseProvider becomes synced
    const checkSyncStatus = () => {
      if (supabaseProvider.isSynced) {
        // Manually update YjsPlugin sync status
        editor.setOption(YjsPlugin, "_isSynced", true);

        // Alternative: trigger the plugin's sync change callback
        const yjsPlugin = editor.getPlugin(YjsPlugin);
        if (yjsPlugin?.options.onSyncChange) {
          yjsPlugin.options.onSyncChange({ type: "supabase", isSynced: true });
        }

        console.log("✅ YjsPlugin sync status updated to true");
      }
    };

    // Check sync status periodically
    const syncCheckInterval = setInterval(checkSyncStatus, 500);

    // Add debug info about awareness and cursors
    setTimeout(() => {
      console.log("🎯 Post-init debug info:", {
        yjsPluginOptions: editor.getOptions(YjsPlugin),
        awarenessState: awareness.getLocalState(),
        awarenessStates: Array.from(awareness.getStates().entries()),
        supabaseConnected: supabaseProvider.isConnected,
        supabaseSynced: supabaseProvider.isSynced,
        yjsPluginSynced: editor.getOption(YjsPlugin, "_isSynced"),
      });
    }, 2000);

    // Add more frequent debugging to monitor cursor updates
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

    // Clear intervals on cleanup
    return () => {
      clearInterval(debugInterval);
      clearInterval(syncCheckInterval);
      console.log("[MyEditorPage] useEffect cleanup: Calling yjs.destroy().");
      editor.getApi(YjsPlugin).yjs.destroy();
      supabaseProvider.disconnect();
    };
  }, [editor]);
  useEffect(() => {
    if (!mounted || !editor) return;

    // Use the original editor.onChange to avoid interference
    const originalOnChange = editor.onChange;

    // Create a type-safe wrapper for originalOnChange
    const safeOriginalOnChange = (value: Value) => {
      if (typeof originalOnChange === "function") {
        originalOnChange(value);
      }
    };

    // Monitor selection changes to debug what's happening with cursor updates
    editor.onChange = (value: Value) => {
      // First call the original onChange to ensure proper behavior
      safeOriginalOnChange(value);

      // Then add our debug logging
      if (editor.selection) {
        // Accessing awareness here doesn't need to be a dependency
        // since we're just reading values, not depending on them changing
        const clientId = awareness.clientID;
        const awarenessState = awareness.getLocalState();

        console.log("📍 Selection changed:", {
          selection: editor.selection,
          clientId,
          awarenessState,
        });
      }
    };

    // Cleanup when component is unmounted
    return () => {
      editor.onChange = originalOnChange;
    };
  }, [editor, mounted]); // Remove awareness from dependencies
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
      </FixedToolbar>{" "}
      {/* Wrap with PlateCursorWrapper to provide a fallback cursor display mechanism */}
      <PlateCursorWrapper>
        <EditorContainer className="relative">
          <Editor placeholder="Type your amazing content here..." />
          {/* RemoteCursorOverlay is already included via YjsPlugin render.afterEditable */}
        </EditorContainer>
      </PlateCursorWrapper>
      <CollaborationDebug
        provider={supabaseProvider}
        ydoc={ydoc}
        awareness={awareness}
      />
      <CursorDebug awareness={awareness} />
    </Plate>
  );
}
