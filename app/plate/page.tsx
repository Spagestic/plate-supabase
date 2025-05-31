/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import * as React from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import type { Value } from "@udecode/plate";
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
import { CollaborationDebug } from "@/components/ui/collaboration-debug";
import { LoadingIndicator } from "./LoadingIndicator";
import { PlateToolbar } from "./PlateToolbar";
import { PlateEditorContainer } from "./PlateEditorContainer";
import { fallbackInitialValue } from "./fallbackInitialValue";
import { createProviderSetup } from "./providerSetup";

const documentId = "5eb6f176-fc34-45a8-bdca-abf08a9118f5"; // Or get this dynamically
const username = `User-${Math.floor(Math.random() * 100)}`; // Or get this from auth

// Generate a consistent color for this user session
const userColor = `#${Math.floor(Math.random() * 16777215)
  .toString(16)
  .padStart(6, "0")}`;

// Use createProviderSetup to get ydoc, awareness, supabaseProvider, channelName
const {
  ydoc,
  awareness,
  supabaseProvider,
  //  channelName
} = createProviderSetup(documentId, username);

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
        return;
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set a short timeout to batch rapid changes while maintaining responsiveness
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from("document")
            .update({
              content: content,
              updated_at: new Date().toISOString(),
            })
            .eq("id", documentId)
            .select(); // Add select to see what was updated

          if (error) {
          } else {
          }
        } catch (error) {}
      }, 100); // 100ms debounce for real-time feel
    },
    [supabase]
  );
  // Load initial content from database
  useEffect(() => {
    async function loadInitialContent() {
      try {
        await supabaseProvider.preloadDatabaseContent();
        const databaseContent = supabaseProvider.getDatabaseContent();
        if (databaseContent && Array.isArray(databaseContent)) {
          setInitialValue(databaseContent);
        } else {
          setInitialValue(fallbackInitialValue);
        }
      } catch (error) {
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
      return;
    }
    supabaseProvider.connect();
    // Initialize Yjs connection, sync document, and set initial editor state
    editor.getApi(YjsPlugin).yjs.init({
      id: documentId, // Use the same documentId
      value: initialValue, // Use the loaded content from database
    });

    // Mark editor as initialized after a short delay to allow YJS to settle
    setTimeout(() => {
      setIsEditorInitialized(true);
    }, 1000); // 1 second delay to ensure YJS is fully initialized
    // Add debug info about awareness and cursors
    setTimeout(() => {}, 2000);
    // Add more frequent debugging to monitor cursor updates
    const debugInterval = setInterval(() => {
      const awarenessStates = Array.from(awareness.getStates().entries());
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
      editor.getApi(YjsPlugin).yjs.destroy();
      supabaseProvider.disconnect();
    };
  }, [editor, mounted, isContentLoaded, initialValue]); // Add YJS document change listener for database saving
  useEffect(() => {
    if (!mounted || !editor || !isContentLoaded) return;
    const handleSelectionChange = () => {
      if (editor?.selection) {
      }
    };

    // Listen to YJS document updates (when content actually changes)
    const handleYjsUpdate = (update: Uint8Array, origin: unknown) => {
      // Only save if this is NOT a remote change from Supabase
      // Remote changes come with origin "supabase-remote"
      if (origin === "supabase-remote") {
        return;
      }

      // Don't save during initialization to prevent empty content saves
      if (!isEditorInitialized) {
        return;
      }

      // Convert YJS content to Slate format for saving
      try {
        // Use editor.children which should now contain the updated content
        const currentContent = editor.children;

        if (currentContent && Array.isArray(currentContent)) {
          saveDocument(currentContent);
        } else {
        }
      } catch (error) {}
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
