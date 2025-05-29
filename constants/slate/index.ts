import { Descendant } from "slate";

// Channel name - using a unique ID to ensure both instances connect to the same channel
export const CHANNEL = "slate-editor-example-6mp9vmt";

// Define the initial value for the editor
export const initialValue: Descendant[] = [
  {
    children: [{ text: "" }],
  },
];

// Random name generators
export const adjectives = ["Happy", "Clever", "Brave", "Bright", "Kind"];
export const nouns = ["Panda", "Tiger", "Eagle", "Dolphin", "Fox"];
