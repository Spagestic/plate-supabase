/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// # Collaborative Editor
// A real-time collaborative text editor that uses Supabase Realtime's broadcast channel to sync document changes between users via YJS CRDT.
"use client";
import { useEffect, useState, useRef } from "react";
import "./styles.css";
import { createClient } from "@/lib/supabase/client";
import * as Y from "yjs";
import Quill from "quill";
import "quill/dist/quill.bubble.css"; // Using bubble theme without toolbar
import type { RealtimeChannel } from "@supabase/supabase-js";
// Channel name - using a unique ID to ensure both instances connect to the same channel
const CHANNEL = "editor-example-6mp9vmt";

export default function Editor() {
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  type ActiveUser = { username: string; [key: string]: any };
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  // Import the correct type for RealtimeChannel from Supabase
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isLocalChangeRef = useRef(false);

  useEffect(() => {
    // Generate a random username
    const adjectives = ["Happy", "Clever", "Brave", "Bright", "Kind"];
    const nouns = ["Panda", "Tiger", "Eagle", "Dolphin", "Fox"];
    const randomName = `${
      adjectives[Math.floor(Math.random() * adjectives.length)]
    }${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(
      Math.random() * 100
    )}`;
    setUsername(randomName);

    // Wait for the editor element to be available
    if (!editorRef.current) return;

    // Initialize Quill without toolbar
    const quill = new Quill(editorRef.current, {
      placeholder: "Start typing to collaborate...",
      theme: "bubble", // Using bubble theme which has no toolbar
      formats: [], // Disable all formatting
      modules: {
        clipboard: true,
        toolbar: false,
      },
    });

    // Apply dark theme styles to Quill editor
    editorRef.current.style.color = "rgb(229, 229, 229)"; // text-neutral-200
    const editor = editorRef.current.querySelector(".ql-editor");
    if (editor) {
      (editor as HTMLElement).style.cssText = `
        height: 100%;
        font-size: 16px;
        padding: 1rem;
        font-family: 'Inter', sans-serif;
      `;
    }

    // Set initial empty content
    quill.setText("");

    quillRef.current = quill;

    // Create a YJS document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create a shared text type
    const ytext = ydoc.getText("quill");

    // Set up Supabase channel
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
    });

    // Handle document updates
    channel.on("broadcast", { event: "document-update" }, (payload) => {
      // Skip if this is our own update
      if (payload.payload.sender === ydoc.clientID) return;

      // Apply YJS update
      const update = new Uint8Array(Object.values(payload.payload.update));

      // Set flag to prevent echo
      isLocalChangeRef.current = true;

      // Apply update to YJS document
      Y.applyUpdate(ydoc, update);

      // Update Quill with the new content
      const newContent = ytext.toString();
      const currentContent = quill.getText();

      if (newContent !== currentContent) {
        quill.setText(newContent);
      }

      isLocalChangeRef.current = false;
    });

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Track presence
        await channel.track({
          user_id: ydoc.clientID,
          username: randomName,
          online_at: new Date().getTime(),
        });

        setIsConnected(true);
      }
    });

    // Listen for Quill text changes
    quill.on("text-change", (delta, oldDelta, source) => {
      if (source !== "user" || isLocalChangeRef.current) return;

      // Update YJS document
      ytext.delete(0, ytext.length);
      ytext.insert(0, quill.getText());

      // Broadcast update
      const update = Y.encodeStateAsUpdate(ydoc);

      // Convert to object for JSON serialization
      const updateObj: Record<number, number> = {};
      update.forEach((value, index) => {
        updateObj[index] = value;
      });

      // Send update via Supabase
      channel.send({
        type: "broadcast",
        event: "document-update",
        payload: {
          update: updateObj,
          sender: ydoc.clientID,
        },
      });
    });

    // Clean up
    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [supabase]);

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white antialiased">
      {/* Header */}
      <div className="flex gap-2 flex-wrap absolute top-4 right-4">
        {activeUsers.map((user, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 text-neutral-300 text-xs"
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
            <div ref={editorRef} className="h-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
