/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useMemo } from "react";
import { createEditor, Descendant } from "slate";
import { Slate, Editable, withReact } from "slate-react";
import { withHistory } from "slate-history";

// Define the initial value for the editor
const initialValue: Descendant[] = [
  {
    children: [{ text: "A line of text in a paragraph." }],
  },
];

// Define custom element components
const CodeElement = (props: any) => {
  return (
    <pre
      {...props.attributes}
      style={{ backgroundColor: "#f4f4f4", padding: "8px" }}
    >
      <code>{props.children}</code>
    </pre>
  );
};

const DefaultElement = (props: any) => {
  return <p {...props.attributes}>{props.children}</p>;
};

// Define custom leaf components
const Leaf = (props: any) => {
  return (
    <span
      {...props.attributes}
      style={{ fontWeight: props.leaf.bold ? "bold" : "normal" }}
    >
      {props.children}
    </span>
  );
};

// Define custom editor commands
const CustomEditor = {
  isBoldMarkActive(editor: any) {
    const marks = editor.marks;
    return marks ? marks.bold === true : false;
  },

  isCodeBlockActive(editor: any) {
    const [match] = editor.nodes({
      match: (n: any) => n.type === "code",
    });

    return !!match;
  },

  toggleBoldMark(editor: any) {
    const isActive = CustomEditor.isBoldMarkActive(editor);
    if (isActive) {
      editor.removeMark("bold");
    } else {
      editor.addMark("bold", true);
    }
  },

  toggleCodeBlock(editor: any) {
    const isActive = CustomEditor.isCodeBlockActive(editor);
    editor.setNodes(
      { type: isActive ? "paragraph" : "code" },
      { match: (n: any) => editor.isBlock(n) }
    );
  },
};

export default function SlateEditorPage() {
  // Create a Slate editor that won't change across renders
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);

  // Define element and leaf rendering functions
  const renderElement = useCallback((props: any) => {
    switch (props.element.type) {
      case "code":
        return <CodeElement {...props} />;
      default:
        return <DefaultElement {...props} />;
    }
  }, []);

  const renderLeaf = useCallback((props: any) => {
    return <Leaf {...props} />;
  }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <Slate editor={editor} initialValue={initialValue}>
        <Editable
          className="min-h-[200px] border rounded p-2"
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          onKeyDown={(event) => {
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
          }}
        />
      </Slate>
    </div>
  );
}
