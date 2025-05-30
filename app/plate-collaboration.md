It looks like you want me to format the provided markdown content. I'll help you clean it up, ensuring proper structure and syntax. Here's the formatted version of your markdown:

---

### Collaboration

Real-time collaboration with Yjs

- **Multi-Provider Support:** Enables real-time collaboration using [Yjs](https://github.com/yjs/yjs) and [slate-yjs](https://docs.slate-yjs.dev/). Supports multiple synchronization providers simultaneously (e.g., Hocuspocus + WebRTC) working on a shared `Y.Doc`.
- **Built-in Providers:** Includes support for [Hocuspocus](https://tiptap.dev/hocuspocus) (server-based) and [WebRTC](https://github.com/yjs/y-webrtc) (peer-to-peer) providers out-of-the-box.
- **Custom Providers:** Extensible architecture allows adding custom providers (e.g., for offline storage like IndexedDB) by implementing the `UnifiedProvider` interface.
- **Awareness & Cursors:** Integrates Yjs Awareness protocol for sharing cursor locations and other ephemeral state between users. Includes [`RemoteCursorOverlay`](/docs/components/remote-cursor-overlay) for rendering remote cursors.
- **Customizable Cursors:** Cursor appearance (name, color) can be customized via `cursors`.
- **Manual Lifecycle:** Provides explicit `init` and `destroy` methods for managing the Yjs connection lifecycle.

---

#### Installation

Install the core Yjs plugin and the specific provider packages you intend to use:

```bash
npm install @udecode/plate-yjs
```

For Hocuspocus server-based collaboration:

```bash
npm install @hocuspocus/provider
```

For WebRTC peer-to-peer collaboration:

```bash
npm install y-webrtc
```

---

#### Usage

##### 1. Configure Plugin

Set up `YjsPlugin` within your Plate editor configuration. Define the providers you want to use in the `providers` array.

```tsx
import { YjsPlugin } from "@udecode/plate-yjs/react";
import { Plate, createPlateEditor } from "@udecode/plate/react";
import { RemoteCursorOverlay } from "@/components/ui/remote-cursor-overlay";
import { EditorContainer } from "@/components/ui/editor";

const editor = createPlateEditor({
  plugins: [
    // ... other plugins
    YjsPlugin.configure({
      // Render remote cursors using the overlay component
      render: {
        afterEditable: RemoteCursorOverlay,
      },
      // Yjs Plugin Options
      options: {
        // Configure local user cursor appearance
        cursors: {
          data: {
            name: "User Name", // Replace with dynamic user name
            color: "#aabbcc", // Replace with dynamic user color
          },
        },
        // Configure providers. All providers share the same Y.Doc and Awareness instance.
        providers: [
          // Example: Hocuspocus provider
          {
            type: "hocuspocus",
            options: {
              name: "my-document-id", // Unique identifier for the document
              url: "ws://localhost:8888", // Your Hocuspocus server URL
              // Additional Hocuspocus options...
            },
          },
          // Example: WebRTC provider (can be used alongside Hocuspocus)
          {
            type: "webrtc",
            options: {
              roomName: "my-document-id", // Must match the document identifier
              signaling: ["ws://localhost:4444"], // Optional: Your signaling server URLs
              // peerOpts: { ... } // Optional: WebRTC Peer options (e.g., for TURN servers)
            },
          },
        ],
      },
    }),
  ],
  // Important: Skip Plate's default initialization when using Yjs
  skipInitialization: true,
});
```

> **Required Editor Configuration**  
> It's crucial to set `skipInitialization: true` when creating the editor. Yjs manages the initial document state, so Plate's default value initialization should be skipped to avoid conflicts.

##### 2. Add Editor Container

The `RemoteCursorOverlay` requires a positioned container around the editor content. Use the [`EditorContainer`](/docs/components/editor) component or `PlateContainer` from `@udecode/plate/react`.

##### 3. Initialize Yjs Connection

Yjs connection and state initialization are handled manually, typically within a `useEffect` hook.

```tsx
import React, { useEffect } from "react";
import { YjsPlugin } from "@udecode/plate-yjs/react";
import { useMounted } from "@/hooks/use-mounted"; // Or your own mounted check

const MyEditorComponent = ({ documentId, initialValue }) => {
  const editor = usePlateEditor(/** editor config from step 1 **/);
  const mounted = useMounted();

  useEffect(() => {
    // Ensure component is mounted and editor is ready
    if (!mounted) return;

    // Initialize Yjs connection, sync document, and set initial editor state
    editor.getApi(YjsPlugin).yjs.init({
      id: documentId, // Unique identifier for the Yjs document
      value: initialValue, // Initial content if the Y.Doc is empty
    });

    // Clean up: Destroy connection when component unmounts
    return () => {
      editor.getApi(YjsPlugin).yjs.destroy();
    };
  }, [editor, mounted]);

  return (
    <Plate editor={editor}>
      <EditorContainer>
        {/* Components to display connection status, user info, etc. */}
        {/* <EditorStatus /> */}
        <Editor />
      </EditorContainer>
    </Plate>
  );
};
```

> **Initial Value**: The `value` passed to `init` is only used to populate the Y.Doc if it's completely empty on the backend/peer network. If the document already exists, its content will be synced, and this initial value will be ignored.
>
> **Lifecycle Management**: You **must** call `editor.api.yjs.init()` to establish the connection and `editor.api.yjs.destroy()` on component unmount to clean up resources.

##### 4. Monitor Connection Status (Optional)

You can access internal state via plugin options or use event handlers (`onConnect`, `onDisconnect`, `onSyncChange`) for more fine-grained control.

```tsx
import React from "react";
import { YjsPlugin } from "@udecode/plate-yjs/react";
import { usePluginOption } from "@udecode/plate/react";

function EditorStatus() {
  // Access provider states directly (read-only)
  const providers = usePluginOption(YjsPlugin, "_providers");
  const isConnected = usePluginOption(YjsPlugin, "_isConnected");

  return (
    <div>
      {providers.map((provider) => (
        <span key={provider.type}>
          {provider.type}: {provider.isConnected ? "Connected" : "Disconnected"}{" "}
          ({provider.isSynced ? "Synced" : "Syncing"})
        </span>
      ))}
    </div>
  );
}

// Alternatively, use event handlers for more complex logic:
YjsPlugin.configure({
  options: {
    // ... other options
    onConnect: ({ type }) => console.debug(`Provider ${type} connected!`),
    onDisconnect: ({ type }) => console.debug(`Provider ${type} disconnected.`),
    onSyncChange: ({ type, isSynced }) =>
      console.debug(`Provider ${type} sync status: ${isSynced}`),
    onError: ({ type, error }) =>
      console.error(`Error in provider ${type}:`, error),
  },
});
```

---

### API

#### `YjsPlugin`

Configure the Yjs plugin using `YjsPlugin.configure({ options: { ... } })`.

<API name="YjsPlugin">
<APIOptions>
 <APIItem name="providers" type="(UnifiedProvider | YjsProviderConfig)[]">
 Array of provider configurations or pre-instantiated provider instances. The plugin will create instances from configurations and use existing instances directly. All providers will share the same Y.Doc and Awareness. Each configuration object specifies a provider `type` (e.g., `'hocuspocus'`,
 `'webrtc'`) and its specific `options`. Custom provider instances must conform to the
 `UnifiedProvider` interface.
 </APIItem>
 <APIItem name="cursors" type="WithCursorsOptions | null" optional>
 Configuration for remote cursors. Set to `null` to explicitly disable cursors. If omitted, cursors are enabled by default if providers are specified. Passed to `withTCursors`. See [WithCursorsOptions API](https://docs.slate-yjs.dev/api/slate-yjs-core/cursor-plugin#withcursors). Includes `data` for local user info and `autoSend` (default `true`).
 </APIItem>
 <APIItem name="ydoc" type="Y.Doc" optional>
 Optional shared Y.Doc instance. If not provided, a new one will be created internally by the plugin. Provide your own if integrating with other Yjs tools or managing multiple documents.
 </APIItem>
 <APIItem name="awareness" type="Awareness" optional>
 Optional shared Awareness instance. If not provided, a new one will be created.
 </APIItem>
 <APIItem name="onConnect" type="(props: { type: YjsProviderType }) => void" optional>
 Callback fired when any provider successfully connects.
 </APIItem>
 <APIItem name="onDisconnect" type="(props: { type: YjsProviderType }) => void" optional>
 Callback fired when any provider disconnects.
 </APIItem>
 <APIItem name="onError" type="(props: { error: Error; type: YjsProviderType }) => void" optional>
 Callback fired when any provider encounters an error (e.g., connection failure).
 </APIItem>
 <APIItem name="onSyncChange" type="(props: { isSynced: boolean; type: YjsProviderType }) => void" optional>
 Callback fired when the sync status (`provider.isSynced`) of any individual provider changes.
 </APIItem>
</APIOptions>
<APIAttributes>
 {/_ Attributes are internal state, generally use options or event handlers instead _/}
 <APIItem name="_isConnected" type="boolean">
 Internal state: Whether at least one provider is currently connected.
 </APIItem>
 <APIItem name="_isSynced" type="boolean">
 Internal state: Reflects overall sync status.
 </APIItem>
 <APIItem name="_providers" type="UnifiedProvider[]">
 Internal state: Array of all active, instantiated provider instances.
 </APIItem>
</APIAttributes>
</API>

#### `editor.api.yjs.init`

Initializes the Yjs connection, binds it to the editor, sets up providers based on plugin configuration, potentially populates the Y.Doc with initial content, and connects providers. **Must be called after the editor is mounted.**

<API name="editor.api.yjs.init">
<APIParameters>
 <APIItem name="options" type="object" optional>
 Configuration object for initialization.
 </APIItem>
</APIParameters>
<APIOptions type="object">
 <APIItem name="id" type="string" optional>
 A unique identifier for the Yjs document (e.g., room name, document ID). If not provided, `editor.id` is used. Essential for ensuring collaborators connect to the same document state.
 </APIItem>
 <APIItem name="value" type="Value | string | ((editor: PlateEditor) => Value | Promise<Value>)" optional>
 The initial content for the editor. **This is only applied if the Y.Doc associated with the `id` is completely empty in the shared state (backend/peers).** If the document already exists, its content will be synced, ignoring this value. Can be Slate JSON (`Value`), an HTML string, or a function returning/resolving to `Value`. If omitted or empty, a default empty paragraph is used for initialization if the Y.Doc is new.
 </APIItem>
 <APIItem name="autoConnect" type="boolean" optional>
 Whether to automatically call `provider.connect()` for all configured providers during initialization. Default: `true`. Set to `false` if you want to manage connections manually using `editor.api.yjs.connect()`.
 </APIItem>
 <APIItem name="autoSelect" type="'start' | 'end'" optional>
 If set, automatically focuses the editor and places the cursor at the 'start' or 'end' of the document after initialization and sync.
 </APIItem>
 <APIItem name="selection" type="Location" optional>
 Specific Slate `Location` to set the selection to after initialization, overriding `autoSelect`.
 </APIItem>
</APIOptions>
<APIReturns type="Promise<void>">
 Resolves when the initial setup (including potential async `value` resolution and YjsEditor binding) is complete. Note that provider connection and synchronization happen asynchronously.
</APIReturns>
</API>

#### `editor.api.yjs.destroy`

Disconnects all providers, cleans up Yjs bindings (detaches editor from Y.Doc), and destroys the awareness instance. **Must be called when the editor component unmounts** to prevent memory leaks and stale connections.

#### `editor.api.yjs.connect`

Manually connects to providers. Useful if `autoConnect: false` was used during `init`.

<API name="editor.api.yjs.connect">
<APIParameters>
 <APIItem name="type" type="YjsProviderType | YjsProviderType[]" optional>
 If provided, only connects to providers of the specified type(s). If omitted, connects to all configured providers that are not already connected.
 </APIItem>
</APIParameters>
</API>

#### `editor.api.yjs.disconnect`

Manually disconnects from providers.

<API name="editor.api.yjs.disconnect">
<APIParameters>
 <APIItem name="type" type="YjsProviderType | YjsProviderType[]" optional>
 If provided, only disconnects from providers of the specified type(s). If omitted, disconnects from all currently connected providers.
 </APIItem>
</APIParameters>
</API>

---

### Provider Types

#### Hocuspocus Provider

Server-based collaboration using [Hocuspocus](https://tiptap.dev/hocuspocus). Requires a running Hocuspocus server.

```tsx
type HocuspocusProviderConfig = {
  type: "hocuspocus";
  options: {
    // HocuspocusProviderConfiguration
    name: string; // Document identifier (must match server/other clients)
    url: string; // WebSocket server URL (e.g., 'ws://localhost:8888')
    token?: string; // Optional authentication token
    // ... see Hocuspocus documentation for all options
  };
};
```

#### WebRTC Provider

Peer-to-peer collaboration using [y-webrtc](https://github.com/yjs/y-webrtc). Requires signaling servers for peer discovery and potentially TURN servers for NAT traversal.

```tsx
type WebRTCProviderConfig = {
  type: "webrtc";
  options: {
    // WebRTCProviderOptions
    roomName: string; // Room name for collaboration (must match other clients)
    signaling?: string[]; // Optional signaling server URLs (defaults to public servers)
    password?: string; // Optional room password
    maxConns?: number; // Max WebRTC connections
    filterBcConns?: boolean; // Filter broadcast connections
    peerOpts?: object; // Options passed to simple-peer (e.g., for ICE/TURN servers)
  };
};
```

#### Custom Provider (`UnifiedProvider`)

Interface for custom provider implementations. If you create a custom provider (e.g., for IndexedDB persistence), it should implement this interface and be registered if necessary.

```typescript
interface UnifiedProvider {
  awareness: Awareness; // Must use the shared Awareness instance
  document: Y.Doc; // Must use the shared Y.Doc instance
  type: string; // Unique type identifier (e.g., 'indexeddb')
  connect: () => void; // Logic to establish connection/load data
  destroy: () => void; // Cleanup logic (called by editor.api.yjs.destroy)
  disconnect: () => void; // Logic to disconnect/save data
  isConnected: boolean; // Provider's connection status
  isSynced: boolean; // Provider's data sync status
}
```

You can pass an instance of your custom provider directly into the `providers` array:

```tsx
const myCustomProvider = new MyCustomProvider({
  doc: ydoc,
  awareness,
  options: {},
});
YjsPlugin.configure({
  options: {
    ydoc,
    awareness,
    providers: [
      myCustomProvider,
      // ... other provider configs or instances
    ],
  },
});
```

---

### Backend Setup

Real-time collaboration requires backend infrastructure depending on the chosen provider(s).

#### Hocuspocus Server

For server-based collaboration using the `hocuspocus` provider:

- Set up a Hocuspocus server instance.
- Follow the instructions in the [Hocuspocus Documentation](https://tiptap.dev/hocuspocus/getting-started).
- Ensure the `url` and `name` in your `YjsPlugin` provider options match your server configuration.

#### WebRTC Configuration

The `webrtc` provider enables peer-to-peer collaboration, reducing server load for document synchronization but requiring additional components for peer discovery and connectivity in challenging network conditions.

##### Signaling Server

Peers need a way to find each other initially. This is done via signaling servers.

- **Default:** `y-webrtc` uses public signaling servers by default (`wss://signaling.yjs.dev`, etc.). These are suitable for testing but not recommended for production due to reliability and privacy concerns.
- **Custom:** For reliability and privacy, run your own signaling server(s). A basic server is included with `y-webrtc`:

```bash
# Install y-webrtc if not already installed
npm install y-webrtc

# Run the signaling server (defaults to port 4444)
PORT=4444 node ./node_modules/y-webrtc/bin/server.js
```

- Configure your client to use your server(s) via the `signaling` option:

```tsx
{
  type: 'webrtc',
  options: {
    roomName: 'document-1',
    signaling: ['ws://your-signaling-server.com:4444'], // Your server URL(s)
  },
}
```

- For details, see the [y-webrtc repository](https://github.com/yjs/y-webrtc) and its [server code](https://github.com/yjs/y-webrtc/blob/master/bin/server.js).

##### TURN Servers (Recommended for Production)

> Direct peer-to-peer WebRTC connections can fail due to firewalls or NAT configurations. Relying solely on WebRTC without fallbacks (like TURN servers or a primary Hocuspocus connection) is **not recommended** for production applications.

TURN (Traversal Using Relays around NAT) servers act as relays when direct P2P connections fail.

- **Services:** Use hosted TURN services like [Twilio Network Traversal Service](https://www.twilio.com/stun-turn) or others.
- **Self-Hosted:** Deploy your own TURN server using open-source software like [Coturn](https://github.com/coturn/coturn).
- **Configuration:** Provide ICE server configurations (including STUN and TURN servers) via the `peerOpts` option in your WebRTC provider settings:

```tsx
{
  type: 'webrtc',
  options: {
    roomName: 'document-1',
    signaling: ['ws://your-signaling-server.com:4444'],
    // Configure ICE servers via simple-peer options
    peerOpts: {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }, // Example public STUN server
          {
            urls: 'turn:your-turn-server.com:3478',
            username: 'your-turn-username',
            credential: 'your-turn-password'
          }
          // Add more STUN/TURN servers as needed
        ]
      }
      // Other WebRTC Peer options can go here
    }
  }
}
```

---

### Security

When implementing real-time collaboration, consider these security aspects:

1. **Authentication**: Use Hocuspocus's `onAuthenticate` hook or similar mechanisms on your backend to validate users before allowing connections or document access. Pass necessary tokens via the `token` option.
2. **Authorization**: Implement document-level access control on your backend (Hocuspocus server or your application server). Verify user permissions before granting access to specific documents (`name`/`roomName`).
3. **WebRTC Security**:
   - Use the `password` option in `y-webrtc` for basic room access control (note: this is transmitted via signaling).
   - Configure secure TURN servers (`turns:` protocol) with credentials for reliable and potentially more private relaying.
   - Use secure signaling servers (`wss://`).
4. **Data Validation**: Although Yjs handles CRDT merging, consider server-side validation if needed for specific content rules beyond structural integrity.
5. **Transport Security**: Always use `wss://` for Hocuspocus and signaling URLs in production to encrypt communication.

Example secure configuration combining Hocuspocus auth and WebRTC with TURN:

```tsx
YjsPlugin.configure({
  options: {
    providers: [
      {
        type: "hocuspocus",
        options: {
          name: "secure-document-id",
          url: "wss://your-hocuspocus-server.com", // Use wss://
          token: "user-auth-token", // Send auth token
          // Server verifies token in onAuthenticate hook
        },
      },
      {
        type: "webrtc",
        options: {
          roomName: "secure-document-id",
          password: "a-strong-room-password", // Basic access control
          signaling: ["wss://your-secure-signaling.com"], // Use wss://
          peerOpts: {
            config: {
              iceServers: [
                // Secure TURN server example
                {
                  urls: "turns:your-turn-server.com:443?transport=tcp", // Use turns://
                  username: "user",
                  credential: "pass",
                },
              ],
            },
          },
        },
      },
    ],
  },
});
```

---

### Troubleshooting

#### Provider Connection Issues

- **Check URLs:** Double-check the `url` for Hocuspocus and the `signaling` URLs for WebRTC. Ensure they are correct and reachable from the client. Use `ws://` for local/unencrypted, `wss://` for production/encrypted.
- **Check Names:** Ensure the `name` (Hocuspocus) or `roomName` (WebRTC) matches exactly for all collaborators intended to join the same document session.
- **Server Status:** Verify that your Hocuspocus server and/or WebRTC signaling server are running and accessible. Check server logs for errors.
- **Firewalls:** Network firewalls might block WebSocket connections (`ws://`, `wss://`) or WebRTC traffic (often dynamic UDP ports). Ensure necessary ports are open or use TURN servers configured for TCP (port 443) for better firewall traversal.
- **TURN Configuration:** If using WebRTC in production and encountering connection problems, ensure your TURN server credentials and URLs are correct in `peerOpts`. Test TURN server connectivity independently.
- **Provider Logs:** Check browser console logs for errors reported by the Hocuspocus or WebRTC providers themselves.

#### Multiple Documents / Dynamic Rooms

- **Unique Y.Doc:** If your application handles multiple collaborative documents simultaneously (e.g., in different tabs or components), ensure you create a **separate `Y.Doc` instance for each distinct document**.
- **Shared Y.Doc/Awareness:** Pass this unique `ydoc` instance and a corresponding `new Awareness(ydoc)` instance into the `YjsPlugin.configure({ options: { ydoc, awareness, ... } })` for that specific editor instance. Do **not** reuse the same Y.Doc/Awareness across logically separate documents.
- **Unique IDs:** Use a unique document identifier (e.g., fetched from your backend) for the `name` (Hocuspocus) or `roomName` (WebRTC) option when configuring providers for each distinct document session. The `id` passed to `editor.api.yjs.init({ id: documentId })` should usually match these provider identifiers.

#### Content Conflicts / Sync Issues

- **Initialization:** Ensure `skipInitialization: true` is set when creating the editor. Initializing Plate's value alongside Yjs fetching existing state is a common source of conflicts. Rely solely on `editor.api.yjs.init({ value: ... })` to handle the initial state _only if the Y.Doc is new_.
- **Provider Mismatch:** Ensure all providers intended for a single document session are configured with the _exact same_ document identifier (`name`/`roomName`). Connecting providers configured for different documents to the same editor will lead to errors or unpredictable behavior.
- **Manual Y.Doc Manipulation:** Avoid directly manipulating the shared `Y.Doc` outside of the Plate editor's operations unless you fully understand the implications for the Slate data structure managed by `slate-yjs`.

#### Cursor Issues

- **Awareness Instance:** Ensure the `awareness` instance provided to the plugin (or the one created internally) is the same one used by all providers connected to the shared `Y.Doc`. Cursors rely on Awareness updates.
- **Cursor Overlay:** Make sure [`RemoteCursorOverlay`](/docs/components/remote-cursor-overlay) (or your own component) is included in `YjsPlugin.configure({ render: { afterEditable: ... } })` and that the editor has a positioned container (`EditorContainer` or `PlateContainer`).
- **`cursors.data`:** Verify that the `cursors.data` (name, color) is being set correctly for the local user. Check the network tab or Yjs debugging tools to see if awareness updates are being sent/received.

---

### Related

- **[Yjs](https://github.com/yjs/yjs):** The CRDT framework powering the collaboration.
- **[slate-yjs](https://docs.slate-yjs.dev/):** Yjs bindings for Slate.
- **[Hocuspocus](https://tiptap.dev/hocuspocus):** Backend persistence and scaling for Yjs.
- **[y-webrtc](https://github.com/yjs/y-webrtc):** WebRTC provider for Yjs.
- **[y-indexeddb](https://github.com/yjs/y-indexeddb):** IndexedDB database provider for Yjs.
- **[Component: RemoteCursorOverlay](/docs/components/remote-cursor-overlay):** Renders remote user cursors.
- **[Component: EditorContainer](/docs/components/editor):** Provides positioning context for overlays.

---

Let me know if you'd like any specific part reformatted further!
