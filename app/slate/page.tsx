"use client";

import "./styles.css";
import React from "react";
import { Slate, Editable } from "slate-react";
import { initialValue } from "@/constants/slate";
import { ActiveUsers, Cursors, useRenderFunctions } from "@/components/slate";
import { useSlateCollaboration, useKeyboardShortcuts } from "@/hooks/slate";

export default function SlateEditorPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { editor, username, activeUsers, connected, sharedType, provider } =
    useSlateCollaboration();

  const { renderElement, renderLeaf } = useRenderFunctions();
  const { handleKeyDown } = useKeyboardShortcuts(editor);

  if (!connected || !sharedType || !provider) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div>Loading collaborative editor...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen antialiased bg-background text-foreground">
      {/* Header */}
      <ActiveUsers activeUsers={activeUsers} />

      {/* Main content */}
      <div className="flex-1 p-12">
        <div className="max-w-4xl mx-auto h-full">
          <div className="h-full text-muted-foreground">
            <Slate editor={editor} initialValue={initialValue}>
              <Cursors>
                <Editable
                  className="min-h-full px-4 py-8 focus:outline-none text-muted-foreground text-base overflow-auto"
                  renderElement={renderElement}
                  renderLeaf={renderLeaf}
                  onKeyDown={handleKeyDown}
                />
              </Cursors>
            </Slate>
          </div>
        </div>
      </div>
    </div>
  );
}
