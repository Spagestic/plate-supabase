"use client";

import * as React from "react";
import { useRef, useState, useEffect } from "react";
import { useEditorRef, usePluginOption } from "@udecode/plate/react";
import { YjsPlugin } from "@udecode/plate-yjs/react";

interface CursorData {
  id: string;
  data: {
    name: string;
    color: string;
  };
}

interface PlateCursorWrapperProps {
  children: React.ReactNode;
}

// Helper function to generate consistent colors for users
function getColorForUser(userId: string): string {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export function PlateCursorWrapper({ children }: PlateCursorWrapperProps) {
  const editor = useEditorRef();
  const containerRef = useRef<HTMLDivElement>(null);
  const awareness = usePluginOption(YjsPlugin, "awareness");
  const [cursors, setCursors] = useState<CursorData[]>([]);

  useEffect(() => {
    if (!awareness || !editor) return;
    const updateCursors = () => {
      const states = awareness.getStates();
      const currentUserId = awareness.clientID;
      const newCursors: CursorData[] = [];

      console.log("PlateCursorWrapper: Awareness states update", {
        totalStates: states.size,
        allStates: Array.from(states.entries()),
      });
      states.forEach((state: unknown, clientId: number) => {
        if (clientId === currentUserId) return;

        // Check for different possible field names in the awareness state
        // We need to use 'any' here to handle different awareness state formats
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stateObj = state as { [key: string]: any };

        // Try to extract user data from various possible locations in the state object
        const userData =
          stateObj.data || // From YjsPlugin cursor config
          stateObj.user || // From older implementations
          {};

        // Try to extract cursor/selection data from various possible fields
        const hasSelection =
          stateObj.selection || // Common field name
          stateObj.cursor?.anchor || // Older implementation
          false;

        if (hasSelection) {
          newCursors.push({
            id: clientId.toString(),
            data: {
              name: userData.name || `User ${clientId}`,
              color: userData.color || getColorForUser(clientId.toString()),
            },
          });
          console.log(
            `PlateCursorWrapper: Found remote cursor for client ${clientId}`,
            {
              userData,
              hasSelection,
            }
          );
        }
      });

      setCursors(newCursors);
    };

    // Initial update
    updateCursors();

    // Listen for awareness changes
    awareness.on("change", updateCursors);

    return () => {
      awareness.off("change", updateCursors);
    };
  }, [awareness, editor]);

  // For now, we'll show cursors in a simple list format
  // This is a simplified approach until we can properly calculate positions
  const activeCursors = cursors.filter((cursor) => cursor.data.name);

  return (
    <div ref={containerRef} className="relative">
      {children}

      {/* Active users indicator */}
      {activeCursors.length > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm z-50">
          <div className="text-sm text-gray-600">
            {activeCursors.length} user{activeCursors.length > 1 ? "s" : ""}{" "}
            editing
          </div>
          <div className="flex gap-1">
            {activeCursors.map((cursor) => (
              <div
                key={cursor.id}
                className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: cursor.data.color }}
                title={cursor.data.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Debug overlay with user list */}
      {activeCursors.length > 0 && (
        <div className="absolute top-16 right-2 bg-black text-white text-xs rounded px-2 py-1 z-50 opacity-80">
          {activeCursors.map((cursor) => (
            <div key={cursor.id} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cursor.data.color }}
              />
              {cursor.data.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
