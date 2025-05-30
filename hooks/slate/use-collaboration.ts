import React, { useEffect, useState, useCallback, useRef } from "react";
import { Descendant } from "slate";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { createClient } from "@/lib/supabase/client";
import initialValue from "@/lib/editor/initialValue";
import {
  ProviderManager,
  createProviderManager,
} from "@/lib/providers/provider-manager";
import { ActiveUser } from "@/types/editor";

export interface CollaborationState {
  connected: boolean;
  sharedType: Y.XmlText | null;
  provider: { awareness: Awareness } | null;
  activeUsers: ActiveUser[];
  username: string;
  documentLoaded: boolean;
  initialContent: Descendant[];
  saveDocument?: (content: Descendant[]) => void;
  isFirstUser: boolean;
  providerManager: ProviderManager | null;
  connectionStatus: Record<string, { connected: boolean; synced: boolean }>;
}

export interface CollaborationHookOptions {
  channelName?: string;
  documentId?: string;
  enableDatabaseSaving?: boolean;
  enableIndexedDB?: boolean;
  enableSupabase?: boolean;
}

/**
 * Enhanced useCollaboration hook using the UnifiedProvider interface
 *
 * This version supports multiple providers working together with shared Y.Doc and Awareness instances.
 */
export function useCollaboration(options: CollaborationHookOptions = {}) {
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [sharedType, setSharedType] = useState<Y.XmlText | null>(null);
  const [provider, setProvider] = useState<{ awareness: Awareness } | null>(
    null
  );
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [initialContent, setInitialContent] =
    useState<Descendant[]>(initialValue);
  const [isFirstUser, setIsFirstUser] = useState(true);
  const [providerManager, setProviderManager] =
    useState<ProviderManager | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<Record<string, { connected: boolean; synced: boolean }>>();

  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Document saving function with debouncing
  const saveDocument = useCallback(
    async (content: Descendant[]) => {
      if (!options.documentId || !options.enableDatabaseSaving) return;

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set a very short timeout to batch rapid changes while maintaining responsiveness
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          console.log("Saving document content:", content);

          const { error } = await supabase
            .from("document")
            .update({
              content: content,
              updated_at: new Date().toISOString(),
            })
            .eq("id", options.documentId);

          if (error) {
            console.error("Error saving document:", error);
          } else {
            console.log("Document saved successfully");
          }
        } catch (error) {
          console.error("Error saving document:", error);
        }
      }, 100); // Very short debounce (100ms) for real-time feel
    },
    [options.documentId, options.enableDatabaseSaving, supabase]
  );
  // Load document from database
  useEffect(() => {
    async function loadDocument() {
      if (!options.documentId || !options.enableDatabaseSaving) {
        setDocumentLoaded(true);
        return;
      }

      try {
        // Load document from database
        const { data: document, error } = await supabase
          .from("document")
          .select("*")
          .eq("id", options.documentId)
          .single();

        if (error) {
          console.error("Error loading document:", error);
        } else if (document?.content) {
          console.log("Loaded document from database");
          // Only set initial content - don't automatically assume we should use it
          // The CollaborativeEditor will decide whether to use this based on collaboration state
          setInitialContent(
            typeof document.content === "string"
              ? JSON.parse(document.content)
              : document.content
          );
        } else {
          console.log("No existing document content, using default");
          // Ensure we have valid default content
          setInitialContent([{ children: [{ text: "" }] }]);
        }

        setDocumentLoaded(true);
      } catch (error) {
        console.error("Error loading document:", error);
        setDocumentLoaded(true);
      }
    }

    loadDocument();
  }, [options.documentId, options.enableDatabaseSaving, supabase]);

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

  // Set up provider manager and providers
  useEffect(() => {
    if (!documentLoaded || !username) return;

    console.log("Setting up provider manager...");

    const manager = createProviderManager({
      documentId: options.documentId || "default",
      username,
      channelName: options.channelName,
      enableIndexedDB: options.enableIndexedDB,
      enableSupabase: options.enableSupabase,
    });

    // Get the shared Y.Doc and create the shared type
    const document = manager.getDocument();
    const awareness = manager.getAwareness();
    const sharedDoc = document.get("slate", Y.XmlText); // Set up awareness change handler for active users
    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const users: ActiveUser[] = [];

      states.forEach((state, clientId) => {
        if (state.user && clientId !== document.clientID) {
          users.push({
            username: state.user.name || `User ${clientId}`,
            ...state.user,
          });
        }
      });

      setActiveUsers(users);

      // Determine if this is the first user based on:
      // 1. No other active users
      // 2. Yjs document is empty (no existing content)
      const isEmptyDocument = sharedDoc.length === 0;
      const hasOtherUsers = users.length > 0;
      const isFirstUserInSession = !hasOtherUsers && isEmptyDocument;

      setIsFirstUser(isFirstUserInSession);
    };

    awareness.on("change", handleAwarenessChange); // Connect all providers
    manager.connectAll().then(() => {
      console.log("All providers connected");

      // Wait a bit for awareness sync before determining if we're the first user
      setTimeout(() => {
        setConnected(true);
        handleAwarenessChange(); // Force an initial check
      }, 500);
    });

    setProviderManager(manager);
    setSharedType(sharedDoc);
    setProvider({ awareness });

    // Set up periodic status updates
    const updateStatus = () => {
      setConnectionStatus(manager.getConnectionStatus());
      setConnected(manager.isAnyProviderConnected());
    };

    statusUpdateIntervalRef.current = setInterval(updateStatus, 1000);
    updateStatus(); // Initial status update

    return () => {
      console.log("Cleaning up provider manager...");
      awareness.off("change", handleAwarenessChange);

      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
      }

      manager.destroy();
    };
  }, [
    username,
    documentLoaded,
    options.documentId,
    options.channelName,
    options.enableIndexedDB,
    options.enableSupabase,
  ]);

  const disconnect = useCallback(() => {
    if (providerManager) {
      providerManager.disconnectAll();
    }
    setConnected(false);
    setSharedType(null);
    setProvider(null);
    setActiveUsers([]);
  }, [providerManager]);

  return {
    connected,
    sharedType,
    provider,
    activeUsers,
    username,
    documentLoaded,
    initialContent,
    saveDocument: options.enableDatabaseSaving ? saveDocument : undefined,
    isFirstUser,
    disconnect,
    providerManager,
    connectionStatus: connectionStatus || {},
  };
}

// Helper functions
export function generateUserColor(): string {
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
}

export function createUserData(name: string, color?: string) {
  return {
    name,
    color: color || generateUserColor(),
  };
}
