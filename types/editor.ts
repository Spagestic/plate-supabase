/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

export type ActiveUser = {
  username: string;
  [key: string]: any;
};

/**
 * Unified Provider Interface for collaborative editing
 *
 * This interface standardizes different provider implementations (Supabase, WebRTC, WebSocket, etc.)
 * to work seamlessly with the collaborative editor while sharing the same Awareness and Y.Doc instances.
 */
export interface UnifiedProvider {
  /** Shared Awareness instance - must be the same across all providers */
  awareness: Awareness;

  /** Shared Y.Doc instance - must be the same across all providers */
  document: Y.Doc;

  /** Unique type identifier for this provider (e.g., 'supabase', 'webrtc', 'websocket', 'indexeddb') */
  type: string;

  /** Logic to establish connection/load data */
  connect: () => void;

  /** Cleanup logic (called by editor.api.yjs.destroy) */
  destroy: () => void;

  /** Logic to disconnect/save data */
  disconnect: () => void;
  /** Provider's connection status */
  isConnected: boolean;

  /** Provider's data sync status */
  isSynced: boolean;

  /** Optional method to pre-load database content before connecting (for better initial sync) */
  preloadDatabaseContent?(): Promise<void>;

  /** Optional method to get cached database content */
  getDatabaseContent?(): any;
}
