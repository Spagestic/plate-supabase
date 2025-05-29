import { KeyboardEvent } from "react";
import { Editor } from "slate";
import { CustomEditor } from "@/components/slate/editor/CustomEditor";

export const useKeyboardShortcuts = (editor: Editor) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    switch (event.key) {
      case "`": {
        event.preventDefault();
        CustomEditor.toggleCodeBlock(editor);
        break;
      }

      case "b": {
        event.preventDefault();
        CustomEditor.toggleBoldMark(editor);
        break;
      }
    }
  };

  return { handleKeyDown };
};
