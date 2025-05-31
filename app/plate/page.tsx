"use client";
import * as React from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import type { Value } from "@udecode/plate";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { createClient } from "@/lib/supabase/client";
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
import { HeadingElement } from "@/components/ui/heading-element";
import { ParagraphElement } from "@/components/ui/paragraph-element";
import { useMounted } from "@/hooks/use-mounted";
import { SupabaseProvider } from "@/lib/providers/unified-providers";
import { CollaborationDebug } from "@/components/ui/collaboration-debug";
import { LoadingIndicator } from "./LoadingIndicator";
import { PlateToolbar } from "./PlateToolbar";
import { PlateEditorContainer } from "./PlateEditorContainer";
import { fallbackInitialValue } from "./fallbackInitialValue";

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
  const [isEditorInitialized, setIsEditorInitialized] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient(); // Document saving function with debouncing and validation
  const saveDocument = useCallback(
    async (content: Value) => {
      // Validate content before saving
      if (!content || !Array.isArray(content) || content.length === 0) {
        console.warn("⚠️ Skipping save: Content is empty or invalid", content);
        return;
      } // Additional validation: check if content has meaningful data
      const hasContent = content.some((node) => {
        if (node.children && Array.isArray(node.children)) {
          return node.children.some(
            (child) =>
              typeof child === "object" &&
              child &&
              "text" in child &&
              typeof child.text === "string" &&
              child.text.trim().length > 0
          );
        }
        return false;
      });

      if (!hasContent) {
        console.warn(
          "⚠️ Skipping save: Content appears to be empty (no meaningful text)",
          content
        );
        return;
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set a short timeout to batch rapid changes while maintaining responsiveness
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          console.log("💾 Attempting to save document content to database:", {
            documentId,
            contentLength: content.length,
            content: content.slice(0, 2), // Show first 2 elements for debugging
          });

          const { data, error } = await supabase
            .from("document")
            .update({
              content: content,
              updated_at: new Date().toISOString(),
            })
            .eq("id", documentId)
            .select(); // Add select to see what was updated

          if (error) {
            console.error("❌ Error saving document:", error);
            console.error("❌ Error details:", {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
            });
          } else {
            console.log("✅ Document saved successfully:", {
              updatedRows: data?.length || 0,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("❌ Unexpected error saving document:", error);
        }
      }, 100); // 100ms debounce for real-time feel
    },
    [supabase]
  );
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

    // Mark editor as initialized after a short delay to allow YJS to settle
    setTimeout(() => {
      setIsEditorInitialized(true);
      console.log("✅ Editor initialization complete, saves are now enabled");
    }, 1000); // 1 second delay to ensure YJS is fully initialized
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
      // Clear any pending save timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Reset initialization flag
      setIsEditorInitialized(false);
      console.log("[MyEditorPage] useEffect cleanup: Calling yjs.destroy().");
      editor.getApi(YjsPlugin).yjs.destroy();
      supabaseProvider.disconnect();
    };
  }, [editor, mounted, isContentLoaded, initialValue]); // Add YJS document change listener for database saving
  useEffect(() => {
    if (!mounted || !editor || !isContentLoaded) return;
    const handleSelectionChange = () => {
      if (editor?.selection) {
        console.log("📍 Selection changed:", {
          selection: editor.selection,
          clientId: awareness.clientID,
          localState: awareness.getLocalState(),
        });
      }
    };

    // Listen to YJS document updates (when content actually changes)
    const handleYjsUpdate = (update: Uint8Array, origin: unknown) => {
      // Only save if this is NOT a remote change from Supabase
      // Remote changes come with origin "supabase-remote"
      if (origin === "supabase-remote") {
        console.log("🔄 YJS document updated from remote (Supabase):", {
          origin,
          updateSize: update.length,
        });
        return;
      }

      // Don't save during initialization to prevent empty content saves
      if (!isEditorInitialized) {
        console.log(
          "🔄 YJS document updated during initialization (skipping save):",
          {
            origin,
            updateSize: update.length,
            isEditorInitialized,
          }
        );
        return;
      }

      console.log("🔄 YJS document updated locally:", {
        origin,
        updateSize: update.length,
        clientId: awareness.clientID,
        isEditorInitialized,
      });

      // Convert YJS content to Slate format for saving
      try {
        // Use editor.children which should now contain the updated content
        const currentContent = editor.children;
        console.log("💾 Attempting to save YJS content to database:", {
          content: currentContent,
          contentLength: currentContent?.length,
        });

        if (currentContent && Array.isArray(currentContent)) {
          saveDocument(currentContent);
        } else {
          console.warn(
            "⚠️ Skipping save: editor.children is not a valid array",
            currentContent
          );
        }
      } catch (error) {
        console.error("Error converting YJS content for saving:", error);
      }
    };
    // Listen to YJS document updates using our shared ydoc instance
    ydoc.on("update", handleYjsUpdate);
    // Keep the selection change listener
    const originalOnChange = editor.onChange;
    if (typeof originalOnChange === "function") {
      editor.onChange = (..._args: unknown[]) => {
        originalOnChange(..._args);
        handleSelectionChange();
      };
    } else {
      editor.onChange = () => {
        handleSelectionChange();
      };
    }
    // Cleanup function
    return () => {
      ydoc.off("update", handleYjsUpdate);
    };
  }, [mounted, editor, isContentLoaded, saveDocument, isEditorInitialized]);
  // Show loading state while content is being loaded
  if (!isContentLoaded) {
    return <LoadingIndicator />;
  }
  return (
    <Plate editor={editor}>
      <PlateToolbar editor={editor} />
      <PlateEditorContainer />
      <CollaborationDebug
        provider={supabaseProvider}
        ydoc={ydoc}
        awareness={awareness}
      />
    </Plate>
  );
}
