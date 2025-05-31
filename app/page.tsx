"use client";

import * as React from "react";

import { fallbackInitialValue } from "./fallbackInitialValue";
import { useProviderSetup } from "./providerSetup";
import { PlateEditorContainer } from "./PlateEditorContainer";
import { useMounted } from "@/hooks/use-mounted";
import { BasicElementsPlugin } from "@udecode/plate-basic-elements/react";
import { BasicMarksPlugin } from "@udecode/plate-basic-marks/react";
import { YjsPlugin } from "@udecode/plate-yjs/react";
import { RemoteCursorOverlay } from "@/components/ui/remote-cursor-overlay";
import { BlockquoteElement } from "@/components/ui/blockquote-element";
import { ParagraphElement } from "@/components/ui/paragraph-element";
import { HeadingElement } from "@/components/ui/heading-element";
import { PlateLeaf } from "@udecode/plate/react";
import type { PlateElementProps, PlateLeafProps } from "@udecode/plate/react";
import { usePlateEditor } from "@udecode/plate/react";
import { CollaborationDebug } from "@/components/ui/collaboration-debug";

export default function TeporaryPlateEditorPage() {
  const mounted = useMounted();
  const documentId = React.useMemo(
    () => "5eb6f176-fc34-45a8-bdca-abf08a9118f5",
    []
  );
  const { username, userColor, ydoc, awareness, supabaseProvider } =
    useProviderSetup(documentId);

  const [isFirstUser, setIsFirstUser] = React.useState<boolean | null>(null);
  const [isSynced, setIsSynced] = React.useState(false);
  const [hasCheckedCollaborationState, setHasCheckedCollaborationState] =
    React.useState(false);

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
              name: username,
              color: userColor,
            },
          },
          providers: [supabaseProvider],
          onConnect: ({ type }) =>
            console.log(`[YjsPlugin] Provider ${type} connected!`),
          onDisconnect: ({ type }) =>
            console.log(`[YjsPlugin] Provider ${type} disconnected.`),
          onError: ({ type, error }) =>
            console.error(`[YjsPlugin] Error in provider ${type}:`, error),
          onSyncChange: ({ type, isSynced }) => {
            console.log(
              `[YjsPlugin] Provider ${type} sync status: ${isSynced}`
            );
            if (type === "supabase") {
              setIsSynced(isSynced);
            }
          },
        },
      }),
    ],
    value: fallbackInitialValue,
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

  React.useEffect(() => {
    if (!mounted || !editor) return;
    awareness.setLocalStateField("data", { name: username, color: userColor });
    supabaseProvider.connect();

    // Check if this is the first user
    const checkFirstUserStatus = () => {
      const awarenessStates = Array.from(awareness.getStates().entries());
      // If there's only one user (this user) or this user has the lowest clientID
      if (awarenessStates.length <= 1) {
        setIsFirstUser(true);
      } else {
        const clientIds = awarenessStates.map(([clientId]) => clientId);
        const isFirst = Math.min(...clientIds) === awareness.clientID;
        setIsFirstUser(isFirst);
      }
      setHasCheckedCollaborationState(true);
    };

    // Initialize after a short delay to allow awareness to update
    const initTimer = setTimeout(() => {
      checkFirstUserStatus();
      editor
        .getApi(YjsPlugin)
        .yjs.init({ id: documentId, value: fallbackInitialValue });
    }, 300);

    const syncInterval = setInterval(() => {
      if (supabaseProvider.isSynced) {
        editor.setOption(YjsPlugin, "_isSynced", true);
        setIsSynced(true);
        editor
          .getPlugin(YjsPlugin)
          ?.options.onSyncChange?.({ type: "supabase", isSynced: true });
      }
    }, 500);

    const awarenessChangeHandler = () => {
      checkFirstUserStatus();
    };

    awareness.on("change", awarenessChangeHandler);

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
      clearTimeout(initTimer);
      clearInterval(syncInterval);
      clearInterval(debugInterval);
      awareness.off("change", awarenessChangeHandler);
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

  if (!mounted) {
    return null;
  }

  // Show loading state when not the first user and not synced yet
  const showLoading = !isFirstUser && !isSynced && hasCheckedCollaborationState;

  return (
    <>
      {showLoading ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="mb-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
            <p className="text-lg font-medium">
              Loading collaborative document...
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Waiting for data synchronization
            </p>
          </div>
        </div>
      ) : (
        <PlateEditorContainer
          editor={editor}
          supabaseProvider={supabaseProvider}
          ydoc={ydoc}
          awareness={awareness}
        />
      )}

      <CollaborationDebug
        provider={supabaseProvider}
        ydoc={ydoc}
        awareness={awareness}
        isFirstUser={isFirstUser || false}
        hasCheckedCollaborationState={hasCheckedCollaborationState}
      />
    </>
  );
}
