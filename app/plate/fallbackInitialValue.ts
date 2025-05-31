import type { Value } from "@udecode/plate";

export const fallbackInitialValue: Value = [
  { type: "h3", children: [{ text: "Title" }] },
  { type: "blockquote", children: [{ text: "This is a quote." }] },
  {
    type: "p",
    children: [
      { text: "With some " },
      { text: "bold", bold: true },
      { text: " text for emphasis!" },
    ],
  },
];
