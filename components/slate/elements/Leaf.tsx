import React from "react";
import { LeafProps } from "@/types/slate";

export const Leaf: React.FC<LeafProps> = (props) => {
  return (
    <span
      {...props.attributes}
      style={{ fontWeight: props.leaf.bold ? "bold" : "normal" }}
    >
      {props.children}
    </span>
  );
};
