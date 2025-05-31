/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Awareness } from "y-protocols/awareness";
import { usePluginOption } from "@udecode/plate/react";
import { YjsPlugin } from "@udecode/plate-yjs/react";

export function CursorDebug({ awareness }: { awareness: Awareness }) {
  const [state, setState] = React.useState<any>({});
  const [mounted, setMounted] = React.useState(false);
  const isSynced = usePluginOption(YjsPlugin, "_isSynced");
  const yjs = usePluginOption(YjsPlugin, "providers");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      const allStates = Array.from(awareness.getStates().entries()).map(
        ([clientId, state]) => ({
          clientId,
          data: state.data,
          selection: state.selection,
        })
      );

      setState({
        localClientId: awareness.clientID,
        connected: isSynced,
        totalUsers: allStates.length,
        states: allStates,
        pluginOptions: yjs,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [awareness, isSynced, yjs]);

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white p-4 rounded-lg font-mono text-xs max-w-xs z-50">
      <div className="mb-2">
        <strong>Cursor Debug</strong>
      </div>
      <div>Status: {isSynced ? "✅ Synced" : "❌ Not Synced"}</div>
      <div>Local ID: {mounted ? awareness.clientID : null}</div>
      <div>Users: {state.totalUsers || 0}</div>
      <details>
        <summary className="cursor-pointer">Remote Users</summary>
        <pre className="mt-2 text-xs max-h-40 overflow-y-auto">
          {JSON.stringify(
            state.states?.filter(
              (s: { clientId: number }) => s.clientId !== awareness.clientID
            ) || [],
            null,
            2
          )}
        </pre>
      </details>
    </div>
  );
}
