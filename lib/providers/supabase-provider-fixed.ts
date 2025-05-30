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

    console.log(`🔌 Connecting SupabaseProvider to channel: ${this.channelName}`);

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
        this._isConnected = true;

        // Track presence for this user
        await this.channel!.track({
          user_id: this.document.clientID,
          username: this.username,
          online_at: new Date().getTime(),
        });

        // Set local awareness state with user information
        this.awareness.setLocalStateField("user", {
          name: this.username,
          color: this.generateUserColor(),
        });

        // Request current state from other connected clients
        console.log("📤 Requesting document state from other clients...");
        this.requestState();

        // Set sync status after allowing time for state requests
        setTimeout(() => {
          if (!this.initialStateReceived) {
            this._isSynced = true;
            console.log("✅ No initial state received, marking as synced");
          }
        }, 1000);

        console.log("🎉 SupabaseProvider connected and ready for collaboration");
      } else if (status === "CHANNEL_ERROR") {
        console.error("❌ SupabaseProvider channel error");
        this._isConnected = false;
        this._isSynced = false;
      } else if (status === "TIMED_OUT") {
        console.error("⏰ SupabaseProvider connection timed out");
        this._isConnected = false;
        this._isSynced = false;
      } else if (status === "CLOSED") {
        console.log("🔌 SupabaseProvider channel closed");
        this._isConnected = false;
        this._isSynced = false;
      }
    });
  }

  disconnect(): void {
    if (!this.channel) {
      console.warn("SupabaseProvider not connected");
      return;
    }

    console.log("🔌 Disconnecting SupabaseProvider");

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
      console.log("👥 Presence sync updated");
    });

    this.channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      console.log(`👋 User ${key} joined`, newPresences);
    });

    this.channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      console.log(`👋 User ${key} left`, leftPresences);
    });
  }

  private setupDocumentSync(): void {
    if (!this.channel) return;

    // Handle incoming document updates from other clients
    this.channel.on("broadcast", { event: "yjs-update" }, (payload: any) => {
      // Ignore updates from ourselves
      if (payload.payload.sender === this.document.clientID) return;

      try {
        console.log("📥 Received Yjs update from client:", payload.payload.sender);
        
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
          this._isSynced = true;
          console.log("✅ Document synced via received update");
        }
      } catch (error) {
        console.error("❌ Error applying Yjs update:", error);
      }
    });

    // Handle state requests from newly connected clients
    this.channel.on("broadcast", { event: "request-yjs-state" }, (payload: any) => {
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
        
        console.log("✅ Sent state response to client:", payload.payload.sender);
      } catch (error) {
        console.error("❌ Error sending state response:", error);
      }
    });

    // Handle state responses from other clients
    this.channel.on("broadcast", { event: "yjs-state-response" }, (payload: any) => {
      // Only process responses meant for us
      if (payload.payload.recipient !== this.document.clientID) return;

      try {
        console.log("📥 Received state response from client:", payload.payload.sender);
        
        // Decode and apply the state
        const state = new Uint8Array(
          atob(payload.payload.state)
            .split("")
            .map((c) => c.charCodeAt(0))
        );
        
        Y.applyUpdate(this.document, state, "supabase-remote");
        this._isSynced = true;
        this.initialStateReceived = true;
        console.log("✅ Applied initial document state from other client");
      } catch (error) {
        console.error("❌ Error applying state response:", error);
      }
    });
  }

  private setupAwarenessSync(): void {
    if (!this.channel) return;

    // Handle incoming awareness updates from other clients
    this.channel.on("broadcast", { event: "awareness-update" }, (payload: any) => {
      // Ignore updates from ourselves
      if (payload.payload.sender === this.document.clientID) return;

      try {
        console.log("👁️ Received awareness update from client:", payload.payload.sender);
        
        // Decode the awareness update
        const update = new Uint8Array(
          atob(payload.payload.update)
            .split("")
            .map((c) => c.charCodeAt(0))
        );
        
        // Apply the awareness update
        applyAwarenessUpdate(this.awareness, update, "supabase-remote");
      } catch (error) {
        console.error("❌ Error applying awareness update:", error);
      }
    });
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
        console.log("👁️ Broadcasting awareness update to other clients");
        
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

  private generateUserColor(): string {
    const colors = [
      "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
      "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
    ];
    return colors[this.document.clientID % colors.length];
  }
}
