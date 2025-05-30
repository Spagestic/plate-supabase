import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { UnifiedProvider } from "@/types/editor";
import { SupabaseProvider, IndexedDBProvider } from "./unified-providers";

/**
 * Provider Manager for handling multiple UnifiedProvider instances
 *
 * This class manages multiple providers (e.g., Supabase + IndexedDB) that share
 * the same Y.Doc and Awareness instances for seamless collaboration.
 */
export class ProviderManager {
  private providers: Map<string, UnifiedProvider> = new Map();
  private document: Y.Doc;
  private awareness: Awareness;

  constructor(document?: Y.Doc, awareness?: Awareness) {
    this.document = document || new Y.Doc();
    this.awareness = awareness || new Awareness(this.document);
  }

  /**
   * Get the shared Y.Doc instance
   */
  getDocument(): Y.Doc {
    return this.document;
  }

  /**
   * Get the shared Awareness instance
   */
  getAwareness(): Awareness {
    return this.awareness;
  }

  /**
   * Add a provider to the manager
   */
  addProvider(provider: UnifiedProvider): void {
    if (this.providers.has(provider.type)) {
      console.warn(`Provider of type '${provider.type}' already exists`);
      return;
    }

    // Ensure the provider uses our shared instances
    if (provider.document !== this.document) {
      console.error(
        `Provider '${provider.type}' must use the shared Y.Doc instance`
      );
      return;
    }

    if (provider.awareness !== this.awareness) {
      console.error(
        `Provider '${provider.type}' must use the shared Awareness instance`
      );
      return;
    }

    this.providers.set(provider.type, provider);
    console.log(`Added provider: ${provider.type}`);
  }

  /**
   * Remove a provider from the manager
   */
  removeProvider(type: string): void {
    const provider = this.providers.get(type);
    if (provider) {
      provider.disconnect();
      this.providers.delete(type);
      console.log(`Removed provider: ${type}`);
    }
  }

  /**
   * Get a specific provider by type
   */
  getProvider(type: string): UnifiedProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get all providers
   */
  getAllProviders(): UnifiedProvider[] {
    return Array.from(this.providers.values());
  }
  /**
   * Connect all providers
   */
  async connectAll(): Promise<void> {
    const promises = Array.from(this.providers.values()).map(
      async (provider) => {
        try {
          // Pre-load database content for Supabase providers before connecting
          if (provider.type === "supabase" && provider.preloadDatabaseContent) {
            await provider.preloadDatabaseContent();
          }

          provider.connect();
          return Promise.resolve();
        } catch (error) {
          console.error(
            `Failed to connect provider '${provider.type}':`,
            error
          );
          return Promise.reject(error);
        }
      }
    );

    await Promise.allSettled(promises);
  }

  /**
   * Disconnect all providers
   */
  disconnectAll(): void {
    for (const provider of this.providers.values()) {
      try {
        provider.disconnect();
      } catch (error) {
        console.error(
          `Failed to disconnect provider '${provider.type}':`,
          error
        );
      }
    }
  }

  /**
   * Destroy all providers and clean up resources
   */
  destroy(): void {
    for (const provider of this.providers.values()) {
      try {
        provider.destroy();
      } catch (error) {
        console.error(`Failed to destroy provider '${provider.type}':`, error);
      }
    }

    this.providers.clear();
    this.awareness.destroy();
    this.document.destroy();
  }

  /**
   * Get the connection status of all providers
   */
  getConnectionStatus(): Record<
    string,
    { connected: boolean; synced: boolean }
  > {
    const status: Record<string, { connected: boolean; synced: boolean }> = {};

    for (const [type, provider] of this.providers) {
      status[type] = {
        connected: provider.isConnected,
        synced: provider.isSynced,
      };
    }

    return status;
  }

  /**
   * Check if any provider is connected
   */
  isAnyProviderConnected(): boolean {
    return Array.from(this.providers.values()).some(
      (provider) => provider.isConnected
    );
  }

  /**
   * Check if all providers are synced
   */
  areAllProvidersSynced(): boolean {
    const providers = Array.from(this.providers.values());
    return (
      providers.length > 0 && providers.every((provider) => provider.isSynced)
    );
  }
}

/**
 * Factory function to create a ProviderManager with common provider configurations
 */
export function createProviderManager(config: {
  documentId: string;
  username: string;
  channelName?: string;
  enableIndexedDB?: boolean;
  enableSupabase?: boolean;
}): ProviderManager {
  const document = new Y.Doc();
  const awareness = new Awareness(document);
  const manager = new ProviderManager(document, awareness);
  // Add Supabase provider if enabled (default: true)
  if (config.enableSupabase !== false) {
    const channelName =
      config.channelName || `slate-editor-${config.documentId}`;
    const supabaseProvider = new SupabaseProvider(
      document,
      awareness,
      channelName,
      config.username,
      config.documentId // Pass documentId for database content loading
    );
    manager.addProvider(supabaseProvider);
  }

  // Add IndexedDB provider if enabled (default: false)
  if (config.enableIndexedDB) {
    const indexedDBProvider = new IndexedDBProvider(
      document,
      awareness,
      config.documentId
    );
    manager.addProvider(indexedDBProvider);
  }

  return manager;
}

/**
 * Hook-like function to create and manage providers for React components
 */
export function useProviderManager(config: {
  documentId: string;
  username: string;
  channelName?: string;
  enableIndexedDB?: boolean;
  enableSupabase?: boolean;
}) {
  // In a real React hook, you'd use useState and useEffect
  // This is just a demonstration of the API

  const manager = createProviderManager(config);

  const connect = async () => {
    await manager.connectAll();
  };

  const disconnect = () => {
    manager.disconnectAll();
  };

  const destroy = () => {
    manager.destroy();
  };

  return {
    manager,
    document: manager.getDocument(),
    awareness: manager.getAwareness(),
    providers: manager.getAllProviders(),
    connectionStatus: manager.getConnectionStatus(),
    isConnected: manager.isAnyProviderConnected(),
    isSynced: manager.areAllProvidersSynced(),
    connect,
    disconnect,
    destroy,
  };
}
