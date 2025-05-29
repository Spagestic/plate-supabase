/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import "./styles.css";
import React, { useCallback, useMemo, useEffect, useState } from "react";
import { createEditor, Descendant, Editor, Transforms } from "slate";
import { Slate, Editable, withReact } from "slate-react";
import { withHistory } from "slate-history";
import { withCursors, withYjs, YjsEditor } from "@slate-yjs/core";
import { useRemoteCursorOverlayPositions } from "@slate-yjs/react";
import { createClient } from "@/lib/supabase/client";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Channel name - using a unique ID to ensure both instances connect to the same channel
const CHANNEL = "slate-editor-example-6mp9vmt";

// Define the initial value for the editor
const initialValue: Descendant[] = [
  {
    children: [{ text: "" }],
  },
];

// Define custom element components
const CodeElement = (props: any) => {
  return (
    <pre
      {...props.attributes}
      style={{ backgroundColor: "#f4f4f4", padding: "8px" }}
    >
      <code>{props.children}</code>
    </pre>
  );
};

const DefaultElement = (props: any) => {
  return <p {...props.attributes}>{props.children}</p>;
};

// Define custom leaf components
const Leaf = (props: any) => {
  return (
    <span
      {...props.attributes}
      style={{ fontWeight: props.leaf.bold ? "bold" : "normal" }}
    >
      {props.children}
    </span>
  );
};

// Cursors component for multiplayer functionality
function Cursors({ children }: { children: React.ReactNode }) {
  const containerRef = React.useRef<HTMLElement>(null);
  const [cursors] = useRemoteCursorOverlayPositions({
    containerRef: containerRef as React.RefObject<HTMLElement>,
  });

  return (
    <div className="cursors relative" ref={containerRef as any}>
      {children}
      {cursors.map((cursor) => (
        <Selection key={cursor.clientId} {...cursor} />
      ))}
    </div>
  );
}

function Selection({ data, selectionRects, caretPosition }: any) {
  if (!data) {
    return null;
  }

  const selectionStyle = {
    backgroundColor: data.color,
  };

  return (
    <>
      {selectionRects.map((position: any, i: number) => (
        <div
          style={{ ...selectionStyle, ...position }}
          className="absolute pointer-events-none opacity-20"
          key={i}
        />
      ))}
      {caretPosition && <Caret caretPosition={caretPosition} data={data} />}
    </>
  );
}

function Caret({ caretPosition, data }: any) {
  const caretStyle = {
    ...caretPosition,
    background: data?.color,
  };

  const labelStyle = {
    transform: "translateY(-100%)",
    background: data?.color,
  };

  return (
    <div style={caretStyle} className="absolute w-0.5">
      <div
        className="absolute text-xs text-white whitespace-nowrap top-0 rounded-md rounded-bl-none px-1.5 py-0.5 pointer-events-none"
        style={labelStyle}
      >
        {data?.name}
      </div>
    </div>
  );
}

// Define custom editor commands
const CustomEditor = {
  isBoldMarkActive(editor: any) {
    const marks = editor.marks;
    return marks ? marks.bold === true : false;
  },

  isCodeBlockActive(editor: any) {
    const [match] = editor.nodes({
      match: (n: any) => n.type === "code",
    });

    return !!match;
  },

  toggleBoldMark(editor: any) {
    const isActive = CustomEditor.isBoldMarkActive(editor);
    if (isActive) {
      editor.removeMark("bold");
    } else {
      editor.addMark("bold", true);
    }
  },

  toggleCodeBlock(editor: any) {
    const isActive = CustomEditor.isCodeBlockActive(editor);
    editor.setNodes(
      { type: isActive ? "paragraph" : "code" },
      { match: (n: any) => editor.isBlock(n) }
    );
  },
};

export default function SlateEditorPage() {
  const supabase = createClient();
  const [username, setUsername] = useState("");
  type ActiveUser = { username: string; [key: string]: any };
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [sharedType, setSharedType] = useState<Y.XmlText | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const channelRef = React.useRef<RealtimeChannel | null>(null);

  // Generate random username
  useEffect(() => {
    const adjectives = ["Happy", "Clever", "Brave", "Bright", "Kind"];
    const nouns = ["Panda", "Tiger", "Eagle", "Dolphin", "Fox"];
    const randomName = `${
      adjectives[Math.floor(Math.random() * adjectives.length)]
    }${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(
      Math.random() * 100
    )}`;
    setUsername(randomName);
  }, []);

  // Set up Yjs provider and document
  useEffect(() => {
    const yDoc = new Y.Doc();
    const sharedDoc = yDoc.get("slate", Y.XmlText);

    // Set up Supabase channel as our "provider"
    const channel = supabase.channel(CHANNEL);
    channelRef.current = channel;

    // Handle presence for user list
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const users: ActiveUser[] = [];

      Object.keys(state).forEach((key) => {
        const presences = state[key];
        presences.forEach((presence: any) => {
          if (presence.username) {
            users.push(presence as ActiveUser);
          }
        });
      });

      setActiveUsers(users);
    }); // Handle document updates via broadcast
    channel.on("broadcast", { event: "yjs-update" }, (payload) => {
      // Skip if this is our own update
      if (payload.payload.sender === yDoc.clientID) return;

      try {
        console.log("Received Yjs update from client:", payload.payload.sender);
        // Apply YJS update - payload.update should be base64 encoded
        const update = new Uint8Array(
          atob(payload.payload.update)
            .split("")
            .map((c) => c.charCodeAt(0))
        );
        Y.applyUpdate(yDoc, update, "remote");
        console.log("Applied Yjs update successfully");
      } catch (error) {
        console.error("Error applying Yjs update:", error);
      }
    }); // Listen to Yjs document updates to broadcast them
    const updateHandler = (update: Uint8Array, origin: any) => {
      // Only broadcast if the update didn't come from remote
      if (origin !== "remote") {
        console.log(
          "Broadcasting Yjs update, origin:",
          origin,
          "size:",
          update.length
        );
        // Convert Uint8Array to base64 string for JSON serialization
        const base64Update = btoa(String.fromCharCode(...update));

        // Send update via Supabase
        channel.send({
          type: "broadcast",
          event: "yjs-update",
          payload: {
            update: base64Update,
            sender: yDoc.clientID,
          },
        });
      } else {
        console.log("Skipping broadcast for remote update");
      }
    };

    yDoc.on("update", updateHandler);

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Track presence
        await channel.track({
          user_id: yDoc.clientID,
          username: username,
          online_at: new Date().getTime(),
        });
        setConnected(true);
      }
    });
    setSharedType(sharedDoc);
    setProvider({ awareness: new Awareness(yDoc) });

    return () => {
      yDoc.off("update", updateHandler);
      if (channel) {
        channel.unsubscribe();
      }
      yDoc.destroy();
    };
  }, [supabase, username]);
  // Create collaborative editor
  const editor = useMemo(() => {
    if (!sharedType || !provider) {
      console.log("Creating basic editor (no collaboration)");
      return withHistory(withReact(createEditor()));
    }

    console.log("Creating collaborative editor with Yjs integration");
    const e = withReact(
      withCursors(withYjs(createEditor(), sharedType), provider.awareness, {
        data: {
          name: username,
          color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
        },
      })
    ); // Ensure editor always has at least 1 valid child
    const { normalizeNode } = e;
    e.normalizeNode = (entry) => {
      const [node] = entry;

      if (!Editor.isEditor(node) || node.children.length > 0) {
        return normalizeNode(entry);
      }

      Transforms.insertNodes(e, initialValue, { at: [0] });
    };
    console.log("Collaborative editor created successfully");
    return e;
  }, [sharedType, provider, username]);
  // Connect/disconnect YjsEditor
  useEffect(() => {
    if (sharedType && editor && !YjsEditor.connected(editor as any)) {
      console.log("Connecting YjsEditor to document");
      YjsEditor.connect(editor as any);
      return () => {
        console.log("Disconnecting YjsEditor from document");
        YjsEditor.disconnect(editor as any);
      };
    }
  }, [editor, sharedType]);

  // Define element and leaf rendering functions
  const renderElement = useCallback((props: any) => {
    switch (props.element.type) {
      case "code":
        return <CodeElement {...props} />;
      default:
        return <DefaultElement {...props} />;
    }
  }, []);

  const renderLeaf = useCallback((props: any) => {
    return <Leaf {...props} />;
  }, []);

  if (!connected || !sharedType || !provider) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        <div>Loading collaborative editor...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white antialiased">
      {/* Header */}
      <div className="flex gap-2 flex-wrap absolute top-4 right-4">
        {activeUsers.map((user, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-800 text-neutral-300 text-xs"
          >
            <div className="w-1 h-1 rounded-full bg-green-400"></div>
            <span>{user.username}</span>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden p-12">
        <div className="max-w-4xl mx-auto h-full">
          <div className="h-full text-neutral-200 overflow-hidden">
            <Slate editor={editor} initialValue={initialValue}>
              <Cursors>
                <Editable
                  className="min-h-full p-4 focus:outline-none text-neutral-200"
                  style={{
                    fontSize: "16px",
                    fontFamily: "'Inter', sans-serif",
                    lineHeight: "1.6",
                  }}
                  renderElement={renderElement}
                  renderLeaf={renderLeaf}
                  onKeyDown={(event) => {
                    if (!event.ctrlKey) {
                      return;
                    }

                    switch (event.key) {
                      case "`": {
                        event.preventDefault();
                        CustomEditor.toggleCodeBlock(editor);
                        break;
                      }

                      case "b": {
                        event.preventDefault();
                        CustomEditor.toggleBoldMark(editor);
                        break;
                      }
                    }
                  }}
                />
              </Cursors>
            </Slate>
          </div>
        </div>
      </div>
    </div>
  );
}
