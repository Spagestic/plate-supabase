/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useRemoteCursorOverlayPositions } from "@slate-yjs/react";
import { Selection } from "./Selection";

// Define CursorData type if not imported from elsewhere
type CursorData = {
  name: string;
  color: string;
  [key: string]: any;
};

interface CursorsProps {
  children: React.ReactNode;
}

export const Cursors: React.FC<CursorsProps> = ({ children }) => {
  const containerRef = React.useRef<HTMLElement>(null);
  const [cursors] = useRemoteCursorOverlayPositions({
    containerRef: containerRef as React.RefObject<HTMLElement>,
  });

  return (
    <div className="cursors" ref={containerRef as any}>
      {children}
      {cursors.map((cursor) => (
        <Selection
          key={cursor.clientId}
          {...cursor}
          clientId={String(cursor.clientId)}
          data={(cursor.data as CursorData) ?? {}}
          caretPosition={
            cursor.caretPosition === null ? undefined : cursor.caretPosition
          }
        />
      ))}
    </div>
  );
};
