/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

export interface ActiveUser {
  username: string;
  [key: string]: any;
}

export interface CursorData {
  name: string;
  color: string;
}

export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CaretPosition {
  left: number;
  top: number;
  height: number;
}

export interface CursorInfo {
  clientId: string;
  data: CursorData;
  selectionRects: SelectionRect[];
  caretPosition?: CaretPosition;
}

export interface SlateProvider {
  awareness: Awareness;
}

export interface ElementProps {
  attributes: any;
  children: React.ReactNode;
  element: any;
}

export interface LeafProps {
  attributes: any;
  children: React.ReactNode;
  leaf: any;
}

export interface SlateEditorState {
  username: string;
  activeUsers: ActiveUser[];
  connected: boolean;
  sharedType: Y.XmlText | null;
  provider: SlateProvider | null;
}
