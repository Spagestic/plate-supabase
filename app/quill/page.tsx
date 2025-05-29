"use client"; // Add this directive to mark as a Client Component

import React from "react";
import dynamic from "next/dynamic";
// dynamic import to ensure the editor is loaded on the client side

const DynamicEditor = dynamic(() => import("./editor"), {
  ssr: false, // Disable server-side rendering for this component
});

export default function Page() {
  return (
    <div>
      <DynamicEditor />
    </div>
  );
}
