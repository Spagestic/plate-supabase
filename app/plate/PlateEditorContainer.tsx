import React from "react";
import { Editor, EditorContainer } from "@/components/ui/editor";

export function PlateEditorContainer() {
  return (
    <EditorContainer>
      <Editor placeholder="Type your amazing content here..." />
    </EditorContainer>
  );
}
