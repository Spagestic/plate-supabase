/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useRef } from "react";
import { createEditor, Editor, Transforms } from "slate";
import { withReact } from "slate-react";
import { withHistory } from "slate-history";
import { withCursors, withYjs, YjsEditor } from "@slate-yjs/core";
import { createClient } from "@/lib/supabase/client";
import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { CHANNEL, initialValue, adjectives, nouns } from "@/constants/slate";
import { ActiveUser } from "@/types/slate";

export const useSlateCollaboration = () => {
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [sharedType, setSharedType] = useState<Y.XmlText | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Generate random username
  useEffect(() => {
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
    const awareness = new Awareness(yDoc);

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
    });

    // Handle document updates via broadcast
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
    });

    // Handle state requests from new clients
    channel.on("broadcast", { event: "request-yjs-state" }, (payload) => {
      // Skip if this is our own request
      if (payload.payload.sender === yDoc.clientID) return;

      // Send current state to the requesting client
      const currentState = Y.encodeStateAsUpdate(yDoc);
      const base64State = btoa(String.fromCharCode(...currentState));

      channel.send({
        type: "broadcast",
        event: "yjs-state-response",
        payload: {
          state: base64State,
          sender: yDoc.clientID,
          recipient: payload.payload.sender,
        },
      });
    });

    // Handle state responses
    channel.on("broadcast", { event: "yjs-state-response" }, (payload) => {
      // Only process if this response is for us
      if (payload.payload.recipient !== yDoc.clientID) return;

      try {
        console.log(
          "Received state response from client:",
          payload.payload.sender
        );
        // Apply the received state
        const state = new Uint8Array(
          atob(payload.payload.state)
            .split("")
            .map((c) => c.charCodeAt(0))
        );
        Y.applyUpdate(yDoc, state, "remote");
        console.log("Applied state response successfully");
      } catch (error) {
        console.error("Error applying state response:", error);
      }
    });

    // Handle awareness updates via broadcast
    channel.on("broadcast", { event: "awareness-update" }, (payload) => {
      // Skip if this is our own update
      if (payload.payload.sender === yDoc.clientID) return;

      try {
        console.log(
          "Received awareness update from client:",
          payload.payload.sender
        );
        const update = new Uint8Array(
          atob(payload.payload.update)
            .split("")
            .map((c) => c.charCodeAt(0))
        );
        applyAwarenessUpdate(awareness, update, "remote");
        console.log("Applied awareness update successfully");
      } catch (error) {
        console.error("Error applying awareness update:", error);
      }
    });

    // Listen to Yjs document updates to broadcast them
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

    // Listen to awareness updates to broadcast them
    const awarenessUpdateHandler = (
      {
        added,
        updated,
        removed,
      }: { added: number[]; updated: number[]; removed: number[] },
      origin: any
    ) => {
      if (origin !== "remote") {
        const changedClients = added.concat(updated, removed);
        if (changedClients.length > 0) {
          console.log(
            "Broadcasting awareness update for clients:",
            changedClients
          );
          const update = encodeAwarenessUpdate(awareness, changedClients);
          const base64Update = btoa(String.fromCharCode(...update));

          channel.send({
            type: "broadcast",
            event: "awareness-update",
            payload: {
              update: base64Update,
              sender: yDoc.clientID,
            },
          });
        }
      }
    };

    yDoc.on("update", updateHandler);
    awareness.on("update", awarenessUpdateHandler);

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Track presence
        await channel.track({
          user_id: yDoc.clientID,
          username: username,
          online_at: new Date().getTime(),
        });

        // Set local awareness state for cursor information
        awareness.setLocalStateField("user", {
          name: username,
          color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
        });

        // Request current state from other clients (if any)
        channel.send({
          type: "broadcast",
          event: "request-yjs-state",
          payload: {
            sender: yDoc.clientID,
          },
        });

        setConnected(true);
      }
    });

    setSharedType(sharedDoc);
    setProvider({ awareness });

    return () => {
      yDoc.off("update", updateHandler);
      awareness.off("update", awarenessUpdateHandler);
      if (channel) {
        channel.unsubscribe();
      }
      awareness.destroy();
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
    );

    // Ensure editor always has at least 1 valid child
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

  return {
    editor,
    username,
    activeUsers,
    connected,
    sharedType,
    provider,
  };
};
