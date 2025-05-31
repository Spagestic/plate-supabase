"use client";

import "@/app/slate/styles.css";
import React, { useState } from "react";
import Link from "next/link";
import { useCollaboration } from "@/hooks//slate/use-collaboration";
import { CollaborativeEditor } from "@/components/slate/CollaborativeEditor";
import { useParams } from "next/navigation";

export default function SlateEditorPage() {
  const { id } = useParams();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [enableIndexedDB, setEnableIndexedDB] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [enableSupabase, setEnableSupabase] = useState(true);
  const [demoDocumentId] = useState(
    Array.isArray(id) ? id[0] : id || "unified-provider-demo"
  );
  const {
    connected,
    // activeUsers,
    sharedType,
    provider,
    username,
    isFirstUser,
    initialContent,
    saveDocument,
    // connectionStatus,
  } = useCollaboration({
    documentId: demoDocumentId,
    enableDatabaseSaving: true,
    enableIndexedDB,
    enableSupabase,
    channelName: `unified-provider-demo-${demoDocumentId}`,
  });

  if (!connected || !sharedType || !provider) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-muted-foreground border-t-transparent rounded-full mx-auto mb-4"></div>
          <div>Loading UnifiedProvider demo...</div>
          <div className="text-sm text-muted-foreground mt-2">
            Initializing providers...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground antialiased">
      {/* Main content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="max-w-6xl mx-auto h-full">
          {/* Editor */}
          <div className="lg:col-span-3 h-full">
            <div className="h-full border border-border rounded-lg bg-card">
              <div className="h-[calc(100%-64px)] overflow-hidden">
                {" "}
                <CollaborativeEditor
                  sharedType={sharedType}
                  provider={provider}
                  username={username}
                  initialContent={initialContent}
                  onSave={saveDocument}
                  isFirstUser={isFirstUser}
                  className="h-full p-4 focus:outline-none text-foreground overflow-auto font-base"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border p-4 bg-card">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <div>
              <p>
                This demo showcases the{" "}
                <code className="text-foreground">UnifiedProvider</code>{" "}
                interface with multiple providers working together.
              </p>{" "}
              <p className="mt-1">
                Changes made here are persisted to the database.
              </p>
            </div>
            <div className="flex gap-4">
              <Link href="/slate" className="text-primary hover:underline">
                Persistent Documents
              </Link>
              <Link href="/" className="text-primary hover:underline">
                Original Demo
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
