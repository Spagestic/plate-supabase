import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { SupabaseProvider } from "@/lib/providers/unified-providers";

export function createProviderSetup(documentId: string, username: string) {
  const channelName = `plate-editor-${documentId}`;
  const ydoc = new Y.Doc();
  const awareness = new Awareness(ydoc);
  const supabaseProvider = new SupabaseProvider(
    ydoc,
    awareness,
    channelName,
    username,
    documentId
  );
  return { ydoc, awareness, supabaseProvider, channelName };
}
