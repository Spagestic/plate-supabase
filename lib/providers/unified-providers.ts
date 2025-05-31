/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { UnifiedProvider } from "@/types/editor";

/**
 * Fixed Supabase Realtime Provider Implementation
 *
 * This class implements the UnifiedProvider interface for Supabase Realtime collaboration.
 * It handles real-time synchronization of Yjs documents and awareness through Supabase channels.
 */
export class SupabaseProvider implements UnifiedProvider {
  public readonly type = "supabase";
  public awareness: Awareness;
  public document: Y.Doc;

  private channel: RealtimeChannel | null = null;
  private supabase = createClient();
  private _isConnected = false;
  private _isSynced = false;
  private initialStateReceived = false;
  private databaseContentCache: any = null;
  private syncTimeoutId: NodeJS.Timeout | null = null;

  // Optional callback functions
  public onConnect?: () => void;
  public onDisconnect?: () => void;
  public onError?: (error: Error) => void;
  public onSyncChange?: (isSynced: boolean) => void;

  constructor(
    document: Y.Doc,
    awareness: Awareness,
    private channelName: string,
    private username: string,
    private documentId?: string,
    callbacks?: {
      onConnect?: () => void;
      onDisconnect?: () => void;
      onError?: (error: Error) => void;
      onSyncChange?: (isSynced: boolean) => void;
    }
  ) {
    this.document = document;
    this.awareness = awareness;

    // Set callbacks if provided
    this.onConnect = callbacks?.onConnect;
    this.onDisconnect = callbacks?.onDisconnect;
    this.onError = callbacks?.onError;
    this.onSyncChange = callbacks?.onSyncChange;

    // Bind event handlers to preserve context
    this.handleYjsUpdate = this.handleYjsUpdate.bind(this);
    this.handleAwarenessUpdate = this.handleAwarenessUpdate.bind(this);
    this.handleYDocSync = this.handleYDocSync.bind(this);

    // Listen to the document's sync events
    this.document.on("sync", this.handleYDocSync);
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isSynced(): boolean {
    return this._isSynced;
  }

  /**
   * Get cached database content for initial loading
   */
  getDatabaseContent(): any {
    return this.databaseContentCache;
  }

  /**
   * Pre-load database content before connecting
   */
  async preloadDatabaseContent(): Promise<void> {
    if (!this.documentId) {
      return;
    }

    try {
      console.log(
        `Pre-loading database content for document: ${this.documentId}`
      );

      const { data: document, error } = await this.supabase
        .from("document")
        .select("content")
        .eq("id", this.documentId)
        .single();

      if (!error && document?.content) {
        this.databaseContentCache =
          typeof document.content === "string"
            ? JSON.parse(document.content)
            : document.content;

        console.log("Database content pre-loaded successfully");
      }
    } catch (error) {
      console.error("Error pre-loading database content:", error);
    }
  }

  connect(): void {
    if (this.channel) {
      console.warn("SupabaseProvider already connected");
      return;
    }
    console.log(
      `🔌 Connecting SupabaseProvider to channel: ${this.channelName}`
    );
    console.log("👤 User info:", {
      username: this.username,
      clientId: this.document.clientID,
    });

    // Create Supabase channel with proper configuration
    this.channel = this.supabase.channel(this.channelName, {
      config: {
        broadcast: {
          self: false, // Don't receive your own broadcasts
        },
        presence: {
          key: this.document.clientID.toString(),
        },
      },
    });

    // Set up all event handlers
    this.setupPresence();
    this.setupDocumentSync();
    this.setupAwarenessSync();

    // Listen to local document and awareness changes
    this.document.on("update", this.handleYjsUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);

    // Subscribe to channel with comprehensive error handling
    this.channel.subscribe(async (status) => {
      console.log(`📡 SupabaseProvider subscription status: ${status}`);

      if (status === "SUBSCRIBED") {
        console.log("[SupabaseProvider] Channel subscribed successfully.");
        this._isConnected = true;

        // Track presence for this user
        await this.channel!.track({
          user_id: this.document.clientID,
          username: this.username,
          online_at: new Date().getTime(),
        });

        console.log(
          "👁️ Awareness will be managed by YjsPlugin with cursor data:",
          {
            clientID: this.document.clientID,
            currentState: this.awareness.getLocalState(),
          }
        );

        // Request current state from other connected clients
        console.log("📤 Requesting document state from other clients...");
        this.requestState();

        // Clear any existing timeout
        if (this.syncTimeoutId) clearTimeout(this.syncTimeoutId);

        // Start a timer to assume sync if no state response is received
        this.syncTimeoutId = setTimeout(() => {
          if (!this._isSynced) {
            console.log(
              "[SupabaseProvider] Timeout waiting for initial state. Assuming synced as first/only client."
            );
            this.setSyncedAndNotify(true);
          }
        }, 2000); // 2-second timeout

        console.log(
          "🎉 SupabaseProvider connected and ready for collaboration"
        );
      } else if (status === "TIMED_OUT") {
        console.error("⏰ SupabaseProvider connection timed out");
        this._isConnected = false;
        this._isSynced = false;
        this.onDisconnect?.();
        this.onError?.(new Error("Supabase channel subscription timed out."));
        this.setSyncedAndNotify(false);
      } else if (status === "CHANNEL_ERROR") {
        console.error("❌ SupabaseProvider channel error");
        this._isConnected = false;
        this._isSynced = false;
        this.onDisconnect?.();
        this.onError?.(new Error("Supabase channel error."));
        this.setSyncedAndNotify(false);
      } else if (status === "CLOSED") {
        console.log("🔌 SupabaseProvider channel closed");
        this._isConnected = false;
        this._isSynced = false;
      }
    });
  }

  disconnect(): void {
    console.log("[SupabaseProvider] Disconnecting...");
    if (this.channel) {
      this.channel.untrack();
      this.channel.unsubscribe();
      this.channel = null;
    }
    this._isConnected = false;
    this._isSynced = false;
    this.onDisconnect?.();
    this.setSyncedAndNotify(false);

    if (this.syncTimeoutId) {
      clearTimeout(this.syncTimeoutId);
      this.syncTimeoutId = null;
    }
    console.log("[SupabaseProvider] Disconnected.");
  }

  destroy(): void {
    this.disconnect();
    this.document.off("update", this.handleYjsUpdate);
    this.document.off("sync", this.handleYDocSync);
    this.awareness.off("update", this.handleAwarenessUpdate);
  }

  private setSyncedAndNotify(isSynced: boolean): void {
    this._isSynced = isSynced;
    this.onSyncChange?.(isSynced);
    console.log(`[SupabaseProvider] Sync status changed to: ${isSynced}`);

    // Emit a custom event that can be listened to by the YjsPlugin
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("supabase-sync-change", {
          detail: { isSynced, provider: this },
        })
      );
    }
  }

  private setupPresence(): void {
    if (!this.channel) return;

    this.channel.on("presence", { event: "sync" }, () => {
      console.log("👥 Presence sync updated");
    });

    this.channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      console.log(`👋 User ${key} joined`, newPresences);
    });

    this.channel.on(
      "presence",
      { event: "leave" },
      ({ key, leftPresences }) => {
        console.log(`👋 User ${key} left`, leftPresences);
      }
    );
  }

  private setupDocumentSync(): void {
    if (!this.channel) return;

    // Handle incoming document updates from other clients
    this.channel.on("broadcast", { event: "yjs-update" }, (payload: any) => {
      // Ignore updates from ourselves
      if (payload.payload.sender === this.document.clientID) return;

      try {
        console.log(
          "📥 Received Yjs update from client:",
          payload.payload.sender
        );

        // Decode the base64 encoded update
        const update = new Uint8Array(
          atob(payload.payload.update)
            .split("")
            .map((c) => c.charCodeAt(0))
        );

        // Apply the update to our document with remote origin
        Y.applyUpdate(this.document, update, "supabase-remote");

        // Mark as synced once we receive updates
        if (!this._isSynced) {
          this.setSyncedAndNotify(true);
          console.log("✅ Document synced via received update");
        }
      } catch (error) {
        console.error("❌ Error applying Yjs update:", error);
      }
    });

    // Handle state requests from newly connected clients
    this.channel.on(
      "broadcast",
      { event: "request-yjs-state" },
      (payload: any) => {
        // Don't respond to our own requests
        if (payload.payload.sender === this.document.clientID) return;

        console.log("📤 State requested by client:", payload.payload.sender);

        try {
          // Encode the current document state
          const currentState = Y.encodeStateAsUpdate(this.document);
          const base64State = btoa(String.fromCharCode(...currentState));

          // Send the state to the requesting client
          this.channel!.send({
            type: "broadcast",
            event: "yjs-state-response",
            payload: {
              state: base64State,
              sender: this.document.clientID,
              recipient: payload.payload.sender,
            },
          });

          console.log(
            "✅ Sent state response to client:",
            payload.payload.sender
          );
        } catch (error) {
          console.error("❌ Error sending state response:", error);
        }
      }
    );

    // Handle state responses from other clients
    this.channel.on(
      "broadcast",
      { event: "yjs-state-response" },
      (payload: any) => {
        // Only process responses meant for us
        if (payload.payload.recipient !== this.document.clientID) return;

        try {
          console.log(
            "📥 Received state response from client:",
            payload.payload.sender
          );

          // Decode and apply the state
          const state = new Uint8Array(
            atob(payload.payload.state)
              .split("")
              .map((c) => c.charCodeAt(0))
          );

          Y.applyUpdate(this.document, state, "supabase-remote");
          this.initialStateReceived = true;
          this.setSyncedAndNotify(true);
          console.log("✅ Applied initial document state from other client");
        } catch (error) {
          console.error("❌ Error applying state response:", error);
        }
      }
    );
  }

  private setupAwarenessSync(): void {
    if (!this.channel) return;

    // Handle incoming awareness updates from other clients
    this.channel.on(
      "broadcast",
      { event: "awareness-update" },
      (payload: any) => {
        // Ignore updates from ourselves
        if (payload.payload.sender === this.document.clientID) return;

        try {
          console.log(
            "👁️ Received awareness update from client:",
            payload.payload.sender
          );

          // Decode the awareness update
          const update = new Uint8Array(
            atob(payload.payload.update)
              .split("")
              .map((c) => c.charCodeAt(0))
          );

          // Apply the awareness update
          applyAwarenessUpdate(this.awareness, update, "supabase-remote");

          // Log current awareness states after update
          console.log("👁️ Current awareness states:", {
            localState: this.awareness.getLocalState(),
            allStates: Array.from(this.awareness.getStates().entries()),
          });
        } catch (error) {
          console.error("❌ Error applying awareness update:", error);
        }
      }
    );
  }

  private handleYjsUpdate(update: Uint8Array, origin: any): void {
    // Don't broadcast updates that came from Supabase (avoid loops)
    if (origin === "supabase-remote" || !this.channel) return;

    try {
      console.log("📤 Broadcasting Yjs update to other clients");

      // Encode the update as base64
      const base64Update = btoa(String.fromCharCode(...update));

      // Broadcast the update
      this.channel.send({
        type: "broadcast",
        event: "yjs-update",
        payload: {
          update: base64Update,
          sender: this.document.clientID,
        },
      });
    } catch (error) {
      console.error("❌ Error broadcasting Yjs update:", error);
    }
  }

  private handleAwarenessUpdate(
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: any
  ): void {
    // Don't broadcast awareness updates that came from Supabase (avoid loops)
    if (origin === "supabase-remote" || !this.channel) return;

    const changedClients = added.concat(updated, removed);
    if (changedClients.length > 0) {
      try {
        console.log("👁️ Broadcasting awareness update to other clients", {
          added,
          updated,
          removed,
          changedClients,
          localState: this.awareness.getLocalState(),
        });

        // Encode the awareness update
        const update = encodeAwarenessUpdate(this.awareness, changedClients);
        const base64Update = btoa(String.fromCharCode(...update));

        // Broadcast the awareness update
        this.channel.send({
          type: "broadcast",
          event: "awareness-update",
          payload: {
            update: base64Update,
            sender: this.document.clientID,
          },
        });
      } catch (error) {
        console.error("❌ Error broadcasting awareness update:", error);
      }
    }
  }

  private requestState(): void {
    if (!this.channel) return;

    try {
      console.log("📤 Requesting current document state from other clients");

      this.channel.send({
        type: "broadcast",
        event: "request-yjs-state",
        payload: {
          sender: this.document.clientID,
        },
      });
    } catch (error) {
      console.error("❌ Error requesting state:", error);
    }
  }

  // Yjs document 'sync' event handler
  private handleYDocSync = (isSyncedStatus: boolean, originProvider?: any) => {
    // Only react if the sync event is about THIS provider instance or if originProvider is undefined/this
    if (originProvider && originProvider !== this) {
      return;
    }

    console.log(
      `[SupabaseProvider] Handling YDoc sync event for this provider. New status: ${isSyncedStatus}`
    );
    this.setSyncedAndNotify(isSyncedStatus);
  };
}

/**
 * IndexedDB Provider Implementation
 *
 * This class implements the UnifiedProvider interface for local persistence using IndexedDB.
 * It can work alongside other providers to provide offline capability.
 */
export class IndexedDBProvider implements UnifiedProvider {
  public readonly type = "indexeddb";
  public awareness: Awareness;
  public document: Y.Doc;

  private _isConnected = false;
  private _isSynced = false;
  private dbName: string;
  private storeName = "yjs-documents";
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(document: Y.Doc, awareness: Awareness, documentId: string) {
    this.document = document;
    this.awareness = awareness;
    this.dbName = `yjs-${documentId}`;

    this.handleYjsUpdate = this.handleYjsUpdate.bind(this);
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isSynced(): boolean {
    return this._isSynced;
  }

  async connect(): Promise<void> {
    console.log(`Connecting IndexedDBProvider for document: ${this.dbName}`);

    try {
      // Load document from IndexedDB
      await this.loadDocument();

      // Listen to document changes for saving
      this.document.on("update", this.handleYjsUpdate);

      this._isConnected = true;
      this._isSynced = true;

      console.log("IndexedDBProvider connected successfully");
    } catch (error) {
      console.error("Failed to connect IndexedDBProvider:", error);
    }
  }

  disconnect(): void {
    if (!this._isConnected) return;

    console.log("Disconnecting IndexedDBProvider");

    // Save final state
    this.saveDocument();

    // Remove event listeners
    this.document.off("update", this.handleYjsUpdate);

    this._isConnected = false;
  }

  destroy(): void {
    this.disconnect();
  }

  private async loadDocument(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.storeName], "readonly");
        const store = transaction.objectStore(this.storeName);
        const getRequest = store.get("document");

        getRequest.onsuccess = () => {
          if (getRequest.result) {
            const update = new Uint8Array(getRequest.result.data);
            Y.applyUpdate(this.document, update);
          }
          db.close();
          resolve();
        };

        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  private async saveDocument(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);

        const update = Y.encodeStateAsUpdate(this.document);
        const putRequest = store.put({ data: Array.from(update) }, "document");

        putRequest.onsuccess = () => {
          db.close();
          resolve();
        };

        putRequest.onerror = () => {
          db.close();
          reject(putRequest.error);
        };
      };
    });
  }

  private handleYjsUpdate(update: Uint8Array, origin: any): void {
    if (origin === "remote") return;

    // Debounced save to IndexedDB
    this.debouncedSave();
  }

  private debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveDocument().catch((error) => {
        console.error("Failed to save to IndexedDB:", error);
      });
    }, 1000); // Save after 1 second of inactivity
  }
}
