/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

// Lifted from slate-yjs https://github.com/BitPhinix/slate-yjs/blob/main/examples/frontend/src/pages/RemoteCursorOverlay/Overlay.tsx

import * as React from "react";

import {
  type CursorOverlayData,
  useRemoteCursorOverlayPositions,
} from "@slate-yjs/react";
import { YjsPlugin } from "@udecode/plate-yjs/react";
import { useEditorContainerRef, usePluginOption } from "@udecode/plate/react";

export function RemoteCursorOverlay() {
  const isSynced = usePluginOption(YjsPlugin, "_isSynced");
  const [forceRender, setForceRender] = React.useState(0);

  // Add debugging
  console.log("🔍 RemoteCursorOverlay rendering, isSynced:", isSynced);

  // Listen for custom sync events from SupabaseProvider
  React.useEffect(() => {
    const handleSyncChange = (event: CustomEvent) => {
      console.log("🔄 Custom sync event received:", event.detail);
      if (event.detail.isSynced) {
        setForceRender((prev) => prev + 1);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "supabase-sync-change",
        handleSyncChange as EventListener
      );
      return () => {
        window.removeEventListener(
          "supabase-sync-change",
          handleSyncChange as EventListener
        );
      };
    }
  }, []);

  // Force re-render periodically to catch sync status changes
  React.useEffect(() => {
    const interval = setInterval(() => {
      setForceRender((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Render if either YjsPlugin says we're synced OR if we detect any remote awareness states
  const shouldRender = isSynced || forceRender > 0;

  if (!shouldRender) {
    console.log("🚫 RemoteCursorOverlay not rendering - not synced yet");
    return null;
  }

  return <RemoteCursorOverlayContent />;
}

function RemoteCursorOverlayContent() {
  const containerRef: any = useEditorContainerRef();
  const [cursors, refresh] = useRemoteCursorOverlayPositions<CursorData>({
    containerRef,
  });

  // Add debugging and try to refresh positions periodically
  React.useEffect(() => {
    console.log("🎯 Remote cursors detailed debug:", {
      cursorsCount: cursors.length,
      cursors: cursors.map((c) => ({
        clientId: c.clientId,
        data: c.data,
        hasCaretPosition: !!c.caretPosition,
        caretPosition: c.caretPosition,
        selectionRectsCount: c.selectionRects.length,
        selectionRects: c.selectionRects,
        rawCursor: c,
      })),
      containerRef: containerRef?.current,
      isContainerMounted: !!containerRef?.current,
    });

    // Force periodic refresh of cursor positions
    const refreshInterval = setInterval(() => {
      if (typeof refresh === "function") {
        refresh();
        console.log("🔄 Forced refresh of remote cursor positions");
      }
    }, 1000); // More frequent refresh

    return () => clearInterval(refreshInterval);
  }, [cursors, containerRef, refresh]);

  // After component mounts, add a one-time check for editor container
  React.useEffect(() => {
    // Log detailed information about the editor container element
    const checkEditorContainer = () => {
      console.log("🔍 Editor container check:", {
        containerRefExists: !!containerRef,
        containerRefCurrentExists: !!containerRef?.current,
        containerElement: containerRef?.current,
        elementBoundingRect: containerRef?.current?.getBoundingClientRect(),
        elementPosition: containerRef?.current
          ? {
              position: window.getComputedStyle(containerRef.current).position,
              top: window.getComputedStyle(containerRef.current).top,
              left: window.getComputedStyle(containerRef.current).left,
            }
          : null,
        editorElements: document.querySelectorAll('[data-slate-editor="true"]')
          .length,
      });
    };

    // Check once on mount
    setTimeout(checkEditorContainer, 500);

    // And then check again after a delay to ensure everything is rendered
    setTimeout(checkEditorContainer, 2000);
  }, [containerRef]);

  return (
    <>
      {cursors.map((cursor) => (
        <RemoteSelection key={cursor.clientId} {...cursor} />
      ))}
    </>
  );
}

function RemoteSelection({
  caretPosition,
  data,
  selectionRects,
}: CursorOverlayData<CursorData>) {
  if (!data) {
    return null;
  }

  const selectionStyle: React.CSSProperties = {
    // Add a opacity to the background color
    backgroundColor: addAlpha(data.color, 0.5),
  };

  return (
    <React.Fragment>
      {selectionRects.map((position, i) => (
        <div
          key={i}
          className="pointer-events-none absolute"
          style={{ ...selectionStyle, ...position }}
        ></div>
      ))}
      {caretPosition && <Caret data={data} caretPosition={caretPosition} />}
    </React.Fragment>
  );
}

export type CursorData = {
  color: string;
  name: string;
};
type CaretProps = Pick<CursorOverlayData<CursorData>, "caretPosition" | "data">;

const cursorOpacity = 0.7;
const hoverOpacity = 1;

function Caret({ caretPosition, data }: CaretProps) {
  const [isHover, setIsHover] = React.useState(false);

  const handleMouseEnter = () => {
    setIsHover(true);
  };
  const handleMouseLeave = () => {
    setIsHover(false);
  };
  const caretStyle: React.CSSProperties = {
    ...caretPosition,
    background: data?.color,
    opacity: cursorOpacity,
    transition: "opacity 0.2s",
  };
  const caretStyleHover = { ...caretStyle, opacity: hoverOpacity };

  const labelStyle: React.CSSProperties = {
    background: data?.color,
    opacity: cursorOpacity,
    transform: "translateY(-100%)",
    transition: "opacity 0.2s",
  };
  const labelStyleHover = { ...labelStyle, opacity: hoverOpacity };

  return (
    <div
      className="absolute w-0.5"
      style={isHover ? caretStyleHover : caretStyle}
    >
      <div
        className="absolute top-0 rounded rounded-bl-none px-1.5 py-0.5 text-xs whitespace-nowrap text-white"
        style={isHover ? labelStyleHover : labelStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {data?.name}
      </div>
    </div>
  );
}

function addAlpha(hexColor: string, opacity: number): string {
  const normalized = Math.round(Math.min(Math.max(opacity, 0), 1) * 255);

  return hexColor + normalized.toString(16).toUpperCase();
}
