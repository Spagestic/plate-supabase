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
 * Supabase Realtime Provider Implementation
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

  constructor(
    document: Y.Doc,
    awareness: Awareness,
    private channelName: string,
    private username: string,
    private documentId?: string
  ) {
    this.document = document;
    this.awareness = awareness;

    // Bind event handlers to preserve context
    this.handleYjsUpdate = this.handleYjsUpdate.bind(this);
    this.handleAwarenessUpdate = this.handleAwarenessUpdate.bind(this);
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

    console.log(`Connecting SupabaseProvider to channel: ${this.channelName}`);

    // Create Supabase channel
    this.channel = this.supabase.channel(this.channelName);

    // Set up presence tracking
    this.setupPresence();

    // Set up document synchronization
    this.setupDocumentSync();

    // Set up awareness synchronization
    this.setupAwarenessSync();

    // Listen to local document and awareness changes
    this.document.on("update", this.handleYjsUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);

    // Subscribe to channel
    this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        this._isConnected = true;

        // Track presence
        await this.channel!.track({
          user_id: this.document.clientID,
          username: this.username,
          online_at: new Date().getTime(),
        });

        // Set local awareness state
        this.awareness.setLocalStateField("user", {
          name: this.username,
          color: this.generateUserColor(),
        }); // Request current state from other clients
        this.requestState();

        // Mark as synced after a short delay to allow for state requests
        setTimeout(() => {
          if (!this.initialStateReceived) {
            this._isSynced = true;
            console.log("No initial state received, marking as synced");
          }
        }, 100); // Reduced from 2000ms to 1000ms for faster sync

        console.log("SupabaseProvider connected successfully");
      }
    });
  }

  disconnect(): void {
    if (!this.channel) {
      console.warn("SupabaseProvider not connected");
      return;
    }

    console.log("Disconnecting SupabaseProvider");

    // Remove event listeners
    this.document.off("update", this.handleYjsUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);

    // Unsubscribe from channel
    this.channel.unsubscribe();
    this.channel = null;

    this._isConnected = false;
    this._isSynced = false;
    this.initialStateReceived = false;
  }

  destroy(): void {
    this.disconnect();
    // Note: We don't destroy the document or awareness here as they might be shared
    // The caller is responsible for managing their lifecycle
  }

  private setupPresence(): void {
    if (!this.channel) return;

    this.channel.on("presence", { event: "sync" }, () => {
      // Handle presence updates for user list
      // This could emit events or call callbacks for UI updates
    });
  }

  private setupDocumentSync(): void {
    if (!this.channel) return;

    // Handle incoming document updates
    this.channel.on("broadcast", { event: "yjs-update" }, (payload) => {
      if (payload.payload.sender === this.document.clientID) return;

      try {
        const update = new Uint8Array(
          atob(payload.payload.update)
            .split("")
            .map((c) => c.charCodeAt(0))
        );
        Y.applyUpdate(this.document, update, "remote");
        this._isSynced = true;
      } catch (error) {
        console.error("Error applying Yjs update:", error);
      }
    });

    // Handle state requests from new clients
    this.channel.on("broadcast", { event: "request-yjs-state" }, (payload) => {
      if (payload.payload.sender === this.document.clientID) return;

      const currentState = Y.encodeStateAsUpdate(this.document);
      const base64State = btoa(String.fromCharCode(...currentState));

      this.channel!.send({
        type: "broadcast",
        event: "yjs-state-response",
        payload: {
          state: base64State,
          sender: this.document.clientID,
          recipient: payload.payload.sender,
        },
      });
    });

    // Handle state responses
    this.channel.on("broadcast", { event: "yjs-state-response" }, (payload) => {
      if (payload.payload.recipient !== this.document.clientID) return;

      try {
        const state = new Uint8Array(
          atob(payload.payload.state)
            .split("")
            .map((c) => c.charCodeAt(0))
        );
        Y.applyUpdate(this.document, state, "remote");
        this._isSynced = true;
        this.initialStateReceived = true;
        console.log("Received and applied initial state from other client");
      } catch (error) {
        console.error("Error applying state response:", error);
      }
    });
  }

  private setupAwarenessSync(): void {
    if (!this.channel) return;

    // Handle incoming awareness updates
    this.channel.on("broadcast", { event: "awareness-update" }, (payload) => {
      if (payload.payload.sender === this.document.clientID) return;

      try {
        const update = new Uint8Array(
          atob(payload.payload.update)
            .split("")
            .map((c) => c.charCodeAt(0))
        );
        applyAwarenessUpdate(this.awareness, update, "remote");
      } catch (error) {
        console.error("Error applying awareness update:", error);
      }
    });
  }

  private handleYjsUpdate(update: Uint8Array, origin: any): void {
    if (origin === "remote" || !this.channel) return;

    const base64Update = btoa(String.fromCharCode(...update));
    this.channel.send({
      type: "broadcast",
      event: "yjs-update",
      payload: {
        update: base64Update,
        sender: this.document.clientID,
      },
    });
  }

  private handleAwarenessUpdate(
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: any
  ): void {
    if (origin === "remote" || !this.channel) return;

    const changedClients = added.concat(updated, removed);
    if (changedClients.length > 0) {
      const update = encodeAwarenessUpdate(this.awareness, changedClients);
      const base64Update = btoa(String.fromCharCode(...update));

      this.channel.send({
        type: "broadcast",
        event: "awareness-update",
        payload: {
          update: base64Update,
          sender: this.document.clientID,
        },
      });
    }
  }

  private requestState(): void {
    if (!this.channel) return;

    this.channel.send({
      type: "broadcast",
      event: "request-yjs-state",
      payload: {
        sender: this.document.clientID,
      },
    });
  }

  private generateUserColor(): string {
    return `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
  }
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

  private saveTimeout: NodeJS.Timeout | null = null;

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
