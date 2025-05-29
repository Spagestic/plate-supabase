import React from "react";
import { ElementProps } from "@/types/slate";

export const CodeElement: React.FC<ElementProps> = (props) => {
  return (
    <pre
      {...props.attributes}
      style={{ backgroundColor: "#f4f4f4", padding: "8px" }}
    >
      <code>{props.children}</code>
    </pre>
  );
};
