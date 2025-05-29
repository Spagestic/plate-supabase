import React from "react";
import { ElementProps } from "@/types/slate";

export const DefaultElement: React.FC<ElementProps> = (props) => {
  return <p {...props.attributes}>{props.children}</p>;
};
