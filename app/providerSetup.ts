import * as React from "react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { SupabaseProvider } from "@/lib/providers/unified-providers";

export function useProviderSetup(documentId: string) {
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

  return {
    username,
    userColor,
    ydoc,
    awareness,
    supabaseProvider,
    channelName,
  };
}
