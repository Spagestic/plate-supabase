import type { Value } from "@udecode/plate";

export const fallbackInitialValue: Value = [
  { type: "h3", children: [{ text: "Title" }] },
  { type: "blockquote", children: [{ text: "This is a quote." }] },
  {
    type: "p",
    children: [
      { text: "Please note that this is a " },
      { text: "temporary", bold: true },
      { text: " editor!" },
    ],
  },
  {
    type: "p",
    children: [{ text: "Changes will not be saved here." }],
  },
];
