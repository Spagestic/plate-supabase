/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { ToolbarButton } from "@/components/ui/toolbar";
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button";

export function PlateToolbar({ editor }: { editor: any }) {
  return (
    <FixedToolbar className="flex justify-start gap-1 rounded-t-lg">
      {/* Element Toolbar Buttons */}
      <ToolbarButton onClick={() => editor.tf.toggleBlock("h1")}>
        H1
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.tf.toggleBlock("h2")}>
        H2
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.tf.toggleBlock("h3")}>
        H3
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.tf.toggleBlock("blockquote")}>
        Quote
      </ToolbarButton>
      {/* Mark Toolbar Buttons */}
      <MarkToolbarButton nodeType="bold" tooltip="Bold (⌘+B)">
        B
      </MarkToolbarButton>
      <MarkToolbarButton nodeType="italic" tooltip="Italic (⌘+I)">
        I
      </MarkToolbarButton>
      <MarkToolbarButton nodeType="underline" tooltip="Underline (⌘+U)">
        U
      </MarkToolbarButton>
    </FixedToolbar>
  );
}
