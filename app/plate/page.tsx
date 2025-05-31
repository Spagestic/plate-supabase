"use client";

import * as React from "react";
import { useEffect, useState } from "react";
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
import { useMounted } from "@/hooks/use-mounted";
import { SupabaseProvider } from "@/lib/providers/unified-providers";
import { CollaborationDebug } from "@/components/ui/collaboration-debug";

const fallbackInitialValue: Value = [
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

// Example: Instantiate your SupabaseProvider
// You'll need to provide actual values for channelName, username, and documentId
const documentId = "5eb6f176-fc34-45a8-bdca-abf08a9118f5"; // Or get this dynamically
const username = `User-${Math.floor(Math.random() * 100)}`; // Or get this from auth
const channelName = `plate-editor-${documentId}`;

// Generate a consistent color for this user session
const userColor = `#${Math.floor(Math.random() * 16777215)
  .toString(16)
  .padStart(6, "0")}`;

// Create Y.Doc and Awareness instances that we'll share between YjsPlugin and our custom provider
const ydoc = new Y.Doc();
const awareness = new Awareness(ydoc);

// Create our custom SupabaseProvider with the shared instances
const supabaseProvider = new SupabaseProvider(
  ydoc,
  awareness,
  channelName,
  username,
  documentId
);

export default function PlateEditorPage() {
  const mounted = useMounted();
  const [initialValue, setInitialValue] = useState<Value>(fallbackInitialValue);
  const [isContentLoaded, setIsContentLoaded] = useState(false);

  // Load initial content from database
  useEffect(() => {
    async function loadInitialContent() {
      try {
        console.log("🔍 Loading initial content from database...");
        await supabaseProvider.preloadDatabaseContent();

        const databaseContent = supabaseProvider.getDatabaseContent();
        if (databaseContent && Array.isArray(databaseContent)) {
          console.log(
            "✅ Using database content as initial value:",
            databaseContent
          );
          setInitialValue(databaseContent);
        } else {
          console.log(
            "📝 No database content found, using fallback initial value"
          );
          setInitialValue(fallbackInitialValue);
        }
      } catch (error) {
        console.error("❌ Error loading initial content:", error);
        setInitialValue(fallbackInitialValue);
      } finally {
        setIsContentLoaded(true);
      }
    }

    loadInitialContent();
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
    // Only initialize editor after content is loaded
    if (!isContentLoaded || !mounted) {
      console.log(
        "[MyEditorPage] Waiting for content to load or component to mount"
      );
      return;
    }

    console.log("🔧 Manually connecting SupabaseProvider...");
    console.log("Provider instance:", supabaseProvider);
    console.log("Provider type:", supabaseProvider.type);
    console.log("Provider connected:", supabaseProvider.isConnected);
    supabaseProvider.connect();
    console.log(
      "Provider connected after connect():",
      supabaseProvider.isConnected
    );

    console.log(
      "[MyEditorPage] useEffect: Component mounted, editor ready with loaded content"
    );
    // Initialize Yjs connection, sync document, and set initial editor state
    console.log(
      "[MyEditorPage] useEffect: Calling yjs.init() with loaded content"
    );
    editor.getApi(YjsPlugin).yjs.init({
      id: documentId, // Use the same documentId
      value: initialValue, // Use the loaded content from database
    });

    // Add debug info about awareness and cursors
    setTimeout(() => {
      console.log("🎯 Post-init debug info:", {
        yjsPluginOptions: editor.getOptions(YjsPlugin),
        awarenessState: awareness.getLocalState(),
        awarenessStates: Array.from(awareness.getStates().entries()),
        supabaseConnected: supabaseProvider.isConnected,
        supabaseSynced: supabaseProvider.isSynced,
        initialValueUsed: initialValue,
      });
    }, 2000);

    // Add more frequent debugging to monitor cursor updates
    const debugInterval = setInterval(() => {
      const awarenessStates = Array.from(awareness.getStates().entries());
      console.log("🔄 Awareness states update:", {
        localClientId: awareness.clientID,
        totalStates: awarenessStates.length,
        states: awarenessStates,
        remoteCursors: awarenessStates.filter(
          ([clientId]) => clientId !== awareness.clientID
        ),
      });
    }, 5000);

    // Clear interval on cleanup
    return () => {
      clearInterval(debugInterval);
      console.log("[MyEditorPage] useEffect cleanup: Calling yjs.destroy().");
      editor.getApi(YjsPlugin).yjs.destroy();
      supabaseProvider.disconnect();
    };
  }, [editor, mounted, isContentLoaded, initialValue]);

  // Add selection change debugging
  useEffect(() => {
    const handleSelectionChange = () => {
      if (editor?.selection) {
        console.log("📍 Selection changed:", {
          selection: editor.selection,
          clientId: awareness.clientID,
          localState: awareness.getLocalState(),
        });
      }
    };

    // Listen to selection changes in the editor
    if (mounted && editor && isContentLoaded) {
      // Add a simple selection change listener
      const originalOnChange = editor.onChange;
      if (typeof originalOnChange === "function") {
        editor.onChange = (value: Value) => {
          originalOnChange(value);
          handleSelectionChange();
        };
      } else {
        editor.onChange = () => {
          handleSelectionChange();
        };
      }
    }
  }, [mounted, editor, isContentLoaded]);

  // Show loading state while content is being loaded
  if (!isContentLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

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
      <CollaborationDebug
        provider={supabaseProvider}
        ydoc={ydoc}
        awareness={awareness}
      />
    </Plate>
  );
}
