/* eslint-disable @typescript-eslint/no-explicit-any */
import { Plate } from "@udecode/plate/react";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { CollaborationDebug } from "@/components/ui/collaboration-debug";
import { CursorDebug } from "@/components/ui/cursor-debug";
import { PlateToolbar } from "./PlateToolbar";

export function PlateEditorContainer({
  editor,
  supabaseProvider,
  ydoc,
  awareness,
}: {
  editor: any;
  supabaseProvider: any;
  ydoc: any;
  awareness: any;
}) {
  return (
    <Plate editor={editor}>
      <FixedToolbar>
        <PlateToolbar editor={editor} />
      </FixedToolbar>
      <EditorContainer className="relative">
        <Editor placeholder="Type your amazing content here..." />
      </EditorContainer>
      <CollaborationDebug
        provider={supabaseProvider}
        ydoc={ydoc}
        awareness={awareness}
      />
      <CursorDebug awareness={awareness} />
    </Plate>
  );
}
