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
import type {
  PlateElementProps,
  PlateLeafProps,
} from "@udecode/plate/react";
import { usePlateEditor } from "@udecode/plate/react";

export default function TeporaryPlateEditorPage() {
  const mounted = useMounted();
  const documentId = React.useMemo(
    () => "5eb6f176-fc34-45a8-bdca-abf08a9118f5",
    []
  );
  const { username, userColor, ydoc, awareness, supabaseProvider } =
    useProviderSetup(documentId);

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
          onSyncChange: ({ type, isSynced }) =>
            console.log(
              `[YjsPlugin] Provider ${type} sync status: ${isSynced}`
            ),
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
    editor
      .getApi(YjsPlugin)
      .yjs.init({ id: documentId, value: fallbackInitialValue });
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

  if (!mounted) {
    return null;
  }

  return (
    <PlateEditorContainer
      editor={editor}
      supabaseProvider={supabaseProvider}
      ydoc={ydoc}
      awareness={awareness}
    />
  );
}
