# Product Requirements Document

## Improved Initial Content Loading for Collaborative Editing

### Current Problems

1. **Race Conditions**: Arbitrary 500ms timeout insufficient for reliable sync
2. **Unreliable First User Detection**: Multiple simultaneous connections cause conflicts
3. **No Proper Sync Protocol**: Missing authoritative initial state mechanism
4. **Timing Issues**: preloadDatabaseContent and connection logic coordination problems
5. **Manual State Management**: Not leveraging Yjs built-in sync capabilities

### Solution Overview

Implement a robust, deterministic initial content loading system using Yjs native sync mechanisms with proper coordination between database, real-time channels, and multiple clients.

---

## Implementation Plan

### Phase 1: Core Infrastructure Improvements

#### 1.1 Enhanced Provider State Management

**Priority: High | Effort: Medium**

```typescript
export class SyncCoordinator {
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;
  private loadingState: "idle" | "loading" | "synced" | "error" = "idle";

  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    // Implementation here
  }
}
```

**Tasks:**

- [ ] Create `SyncCoordinator` class to manage initialization lifecycle
- [ ] Implement proper state machine for loading states
- [ ] Add promise-based initialization with proper error handling
- [ ] Add timeout mechanisms with exponential backoff

#### 1.2 Yjs State Vector Implementation

**Priority: High | Effort: High**

```typescript
export class YjsStateSync {
  static async getDocumentStateVector(doc: Y.Doc): Promise<Uint8Array> {
    return Y.encodeStateVector(doc);
  }

  static async getDatabaseStateDiff(
    stateVector: Uint8Array,
    documentId: string
  ): Promise<Uint8Array | null> {
    // Query database for updates since stateVector
  }

  static async applyDatabaseUpdates(
    doc: Y.Doc,
    updates: Uint8Array[]
  ): Promise<void> {
    // Apply updates in correct order
  }
}
```

**Tasks:**

- [ ] Implement Yjs state vector comparison for efficient sync
- [ ] Create database schema for storing Yjs updates chronologically
- [ ] Implement state vector querying from database
- [ ] Add atomic update application with conflict resolution

#### 1.3 Database Schema Enhancement

**Priority: High | Effort: Medium**

```sql
-- Add to Supabase migration
CREATE TABLE document_updates (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES document(id),
  update_data BYTEA NOT NULL,
  client_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  state_vector BYTEA
);

CREATE INDEX idx_document_updates_document_created
ON document_updates(document_id, created_at);

CREATE INDEX idx_document_updates_state_vector
ON document_updates(document_id, state_vector);
```

**Tasks:**

- [ ] Create `document_updates` table for granular update storage
- [ ] Add proper indexes for efficient querying
- [ ] Implement update cleanup/compaction strategy
- [ ] Add state vector storage for efficient diff calculation

### Phase 2: Deterministic Loading Protocol

#### 2.1 Initial Sync Protocol Implementation

**Priority: High | Effort: High**

```typescript
export class InitialSyncProtocol {
  async performInitialSync(
    doc: Y.Doc,
    awareness: Awareness,
    provider: SupabaseProvider,
    documentId: string
  ): Promise<SyncResult> {
    // Step 1: Get current state vector
    const localStateVector = Y.encodeStateVector(doc);

    // Step 2: Request missing updates from database
    const missingUpdates = await this.getMissingUpdates(
      documentId,
      localStateVector
    );

    // Step 3: Apply updates atomically
    await this.applyUpdatesAtomically(doc, missingUpdates);

    // Step 4: Connect to real-time channel
    await provider.connect();

    // Step 5: Final state reconciliation
    return this.performFinalReconciliation(doc, provider);
  }
}
```

**Tasks:**

- [ ] Implement deterministic 5-step initial sync protocol
- [ ] Add atomic update application with rollback capability
- [ ] Implement state reconciliation after real-time connection
- [ ] Add comprehensive error handling and retry logic

#### 2.2 Loading State Coordination

**Priority: Medium | Effort: Medium**

```typescript
export function useCollaborativeEditor(config: EditorConfig) {
  const [loadingState, setLoadingState] =
    useState<LoadingState>("initializing");
  const [syncCoordinator] = useState(() => new SyncCoordinator());

  useEffect(() => {
    const initializeEditor = async () => {
      try {
        setLoadingState("loading-database");
        await syncCoordinator.waitForInitialization();

        setLoadingState("connecting-realtime");
        await provider.connect();

        setLoadingState("syncing");
        await syncCoordinator.performFinalSync();

        setLoadingState("ready");
      } catch (error) {
        setLoadingState("error");
        handleError(error);
      }
    };

    initializeEditor();
  }, []);

  return { loadingState, editor, provider };
}
```

**Tasks:**

- [ ] Create unified React hook for collaborative editor management
- [ ] Implement granular loading states with proper transitions
- [ ] Add error boundaries and recovery mechanisms
- [ ] Implement loading progress indicators

### Phase 3: Enhanced Provider Architecture

#### 3.1 Multi-Provider Coordination

**Priority: Medium | Effort: High**

```typescript
export class ProviderCoordinator {
  private providers: Map<string, UnifiedProvider> = new Map();
  private syncState: Map<string, boolean> = new Map();

  async initializeProviders(config: ProviderConfig): Promise<void> {
    // Initialize database provider first (authoritative)
    await this.initializeDatabaseProvider(config);

    // Initialize real-time providers
    await this.initializeRealtimeProviders(config);

    // Initialize local persistence providers
    await this.initializeLocalProviders(config);

    // Perform cross-provider synchronization
    await this.synchronizeProviders();
  }

  private async synchronizeProviders(): Promise<void> {
    // Implement provider sync logic
  }
}
```

**Tasks:**

- [ ] Implement provider initialization hierarchy (database → realtime → local)
- [ ] Add cross-provider state synchronization
- [ ] Implement provider health monitoring and failover
- [ ] Add provider priority system for conflict resolution

#### 3.2 Enhanced SupabaseProvider

**Priority: High | Effort: Medium**

```typescript
export class EnhancedSupabaseProvider extends SupabaseProvider {
  private initializationProtocol: InitialSyncProtocol;
  private syncCoordinator: SyncCoordinator;

  async connect(): Promise<void> {
    // Use protocol-based connection instead of timeout-based
    await this.initializationProtocol.performInitialSync(
      this.document,
      this.awareness,
      this,
      this.documentId
    );
  }

  async preloadDatabaseContent(): Promise<void> {
    // Enhanced preloading with state vector support
    const stateVector = Y.encodeStateVector(this.document);
    const updates = await this.getMissingUpdates(stateVector);
    await this.applyUpdatesAtomically(updates);
  }
}
```

**Tasks:**

- [ ] Extend SupabaseProvider with protocol-based initialization
- [ ] Implement state vector-based preloading
- [ ] Add atomic update application
- [ ] Implement proper connection lifecycle management

### Phase 4: UI/UX Improvements

#### 4.1 Enhanced Loading States

**Priority: Medium | Effort: Low**

```typescript
export function CollaborativeLoadingIndicator({
  state,
  progress,
  error,
}: LoadingProps) {
  const getLoadingMessage = () => {
    switch (state) {
      case "loading-database":
        return "Loading document content...";
      case "connecting-realtime":
        return "Connecting to collaboration...";
      case "syncing":
        return "Synchronizing with other users...";
      case "ready":
        return "Ready for collaboration!";
      case "error":
        return "Connection failed. Retrying...";
      default:
        return "Initializing...";
    }
  };

  return (
    <div className="collaborative-loading">
      <ProgressBar progress={progress} />
      <LoadingMessage message={getLoadingMessage()} />
      {error && <ErrorMessage error={error} />}
    </div>
  );
}
```

**Tasks:**

- [ ] Create detailed loading indicator component
- [ ] Add progress tracking for initialization steps
- [ ] Implement error display with retry actions
- [ ] Add accessibility features for loading states

#### 4.2 Editor Initialization Component

**Priority: Medium | Effort: Low**

```typescript
export default function EnhancedPlateEditorPage() {
  const { loadingState, editor, provider, error } = useCollaborativeEditor({
    documentId,
    username,
    enableIndexedDB: true,
    enableSupabase: true,
  });

  if (loadingState !== "ready") {
    return <CollaborativeLoadingIndicator state={loadingState} error={error} />;
  }

  return (
    <Plate editor={editor}>
      <PlateToolbar editor={editor} />
      <PlateEditorContainer />
      <CollaborationDebug provider={provider} />
    </Plate>
  );
}
```

**Tasks:**

- [ ] Refactor main page component to use new loading system
- [ ] Remove timeout-based logic and "first user" detection
- [ ] Implement proper error boundaries
- [ ] Add retry mechanisms for failed connections

### Phase 5: Testing & Validation

#### 5.1 Integration Testing

**Priority: High | Effort: Medium**

**Tasks:**

- [ ] Create test scenarios for multiple simultaneous connections
- [ ] Test race condition scenarios
- [ ] Validate proper sync across different connection orders
- [ ] Test offline/online scenarios with proper state recovery

#### 5.2 Performance Testing

**Priority: Medium | Effort: Medium**

**Tasks:**

- [ ] Benchmark initialization time improvements
- [ ] Test with large documents (>1MB content)
- [ ] Validate memory usage with multiple providers
- [ ] Test scalability with 10+ concurrent users

### Phase 6: Documentation & Migration

#### 6.1 Migration Guide

**Priority: Low | Effort: Low**

**Tasks:**

- [ ] Create migration guide from current implementation
- [ ] Document breaking changes and upgrade path
- [ ] Provide configuration examples
- [ ] Add troubleshooting guide

#### 6.2 API Documentation

**Priority: Low | Effort: Low**

**Tasks:**

- [ ] Document new hooks and components
- [ ] Create provider configuration guide
- [ ] Add best practices documentation
- [ ] Provide integration examples

---

## Success Criteria

1. **Reliability**: 99%+ successful initializations across different connection scenarios
2. **Performance**: <2s initialization time for documents up to 1MB
3. **Consistency**: No race conditions or duplicate content loading
4. **Scalability**: Support 20+ concurrent users without degradation
5. **User Experience**: Clear loading states and error handling

## Timeline Estimate

- **Phase 1-2**: 2-3 weeks (Core infrastructure & protocol)
- **Phase 3**: 1-2 weeks (Provider enhancements)
- **Phase 4**: 1 week (UI improvements)
- **Phase 5-6**: 1 week (Testing & documentation)

**Total**: 5-7 weeks

This plan eliminates the current timeout-based approach and implements a robust, deterministic system using Yjs native capabilities with proper coordination mechanisms.
