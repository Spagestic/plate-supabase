import React from "react";
import { CursorData, CaretPosition } from "@/types/slate";

interface CaretProps {
  caretPosition: CaretPosition;
  data: CursorData;
}

export const Caret: React.FC<CaretProps> = ({ caretPosition, data }) => {
  const caretStyle = {
    ...caretPosition,
    background: data?.color,
  };

  const labelStyle = {
    transform: "translateY(-100%)",
    background: data?.color,
  };

  return (
    <div style={caretStyle} className="caretMarker">
      <div className="caret" style={labelStyle}>
        {data?.name}
      </div>
    </div>
  );
};
