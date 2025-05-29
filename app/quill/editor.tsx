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
  const ytextRef = useRef<Y.Text | null>(null);
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

    quillRef.current = quill; // Create a YJS document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create a shared text type
    const ytext = ydoc.getText("quill");
    ytextRef.current = ytext;

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
    }); // Handle document updates
    channel.on("broadcast", { event: "document-update" }, (payload) => {
      // Skip if this is our own update
      if (payload.payload.sender === ydoc.clientID) return;

      try {
        // Apply YJS update - payload.update should be base64 encoded
        const update = new Uint8Array(
          atob(payload.payload.update)
            .split("")
            .map((c) => c.charCodeAt(0))
        );

        // Apply update to YJS document with "remote" origin
        Y.applyUpdate(ydoc, update, "remote");
      } catch (error) {
        console.error("Error applying document update:", error);
      }
    });

    // Handle state requests from new clients
    channel.on("broadcast", { event: "request-state" }, (payload) => {
      // Skip if this is our own request
      if (payload.payload.sender === ydoc.clientID) return;

      // Send current state to the requesting client
      const currentState = Y.encodeStateAsUpdate(ydoc);
      const base64State = btoa(String.fromCharCode(...currentState));

      channel.send({
        type: "broadcast",
        event: "state-response",
        payload: {
          state: base64State,
          sender: ydoc.clientID,
          recipient: payload.payload.sender,
        },
      });
    });

    // Handle state responses
    channel.on("broadcast", { event: "state-response" }, (payload) => {
      // Only process if this response is for us
      if (payload.payload.recipient !== ydoc.clientID) return;

      try {
        // Apply the received state
        const state = new Uint8Array(
          atob(payload.payload.state)
            .split("")
            .map((c) => c.charCodeAt(0))
        ); // Set flag to prevent echo
        isLocalChangeRef.current = true;

        // Apply state to YJS document with "remote" origin
        Y.applyUpdate(ydoc, state, "remote");

        // Update Quill with the new content
        const newContent = ytext.toString();
        quill.setText(newContent);
        isLocalChangeRef.current = false;
      } catch (error) {
        console.error("Error applying state response:", error);
      }
    });

    // Listen to YJS document updates to broadcast them
    const updateHandler = (update: Uint8Array, origin: any) => {
      // Only broadcast if the update didn't come from remote
      if (origin !== "remote") {
        console.log(
          "Broadcasting YJS update, origin:",
          origin,
          "size:",
          update.length
        );
        // Convert Uint8Array to base64 string for JSON serialization
        const base64Update = btoa(String.fromCharCode(...update));

        // Send update via Supabase
        channel.send({
          type: "broadcast",
          event: "document-update",
          payload: {
            update: base64Update,
            sender: ydoc.clientID,
          },
        });
      } else {
        console.log("Skipping broadcast for remote update");
      }
    };

    // Listen to YJS text changes to update Quill
    const ytextObserver = () => {
      if (isLocalChangeRef.current) return;

      const newContent = ytext.toString();
      const currentContent = quill.getText();

      if (newContent !== currentContent) {
        isLocalChangeRef.current = true;
        quill.setText(newContent);
        isLocalChangeRef.current = false;
      }
    };

    // Set up YJS listeners
    ydoc.on("update", updateHandler);
    ytext.observe(ytextObserver);

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Track presence
        await channel.track({
          user_id: ydoc.clientID,
          username: randomName,
          online_at: new Date().getTime(),
        });

        // Request current state from other clients (if any)
        channel.send({
          type: "broadcast",
          event: "request-state",
          payload: {
            sender: ydoc.clientID,
          },
        });

        setIsConnected(true);
      }
    }); // Listen for Quill text changes
    quill.on("text-change", (delta, oldDelta, source) => {
      if (source !== "user" || isLocalChangeRef.current) return;

      // Update YJS document directly - this will trigger the updateHandler
      ytext.delete(0, ytext.length);
      ytext.insert(0, quill.getText());
    }); // Clean up
    return () => {
      // Remove YJS listeners
      ydoc.off("update", updateHandler);
      ytext.unobserve(ytextObserver);

      if (channel) {
        channel.unsubscribe();
      }

      // Destroy YJS document
      ydoc.destroy();
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
