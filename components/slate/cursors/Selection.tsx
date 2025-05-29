import React from "react";
import { Caret } from "./Caret";
import { CursorInfo } from "@/types/slate";

export const Selection: React.FC<CursorInfo> = ({
  data,
  selectionRects,
  caretPosition,
}) => {
  if (!data) {
    return null;
  }

  const selectionStyle = {
    backgroundColor: data.color,
  };

  return (
    <>
      {selectionRects.map((position, i: number) => (
        <div
          style={{ ...selectionStyle, ...position }}
          className="selection"
          key={i}
        />
      ))}
      {caretPosition && <Caret caretPosition={caretPosition} data={data} />}
    </>
  );
};
