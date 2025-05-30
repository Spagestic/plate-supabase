"use client";

import React, { useEffect, useState } from "react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { SupabaseProvider } from "@/lib/providers/unified-providers";

export default function CollaborationTest() {
  const [content, setContent] = useState("");
  const [users, setUsers] = useState(0);
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    console.log("🧪 Starting collaboration test...");

    // Create shared Y.Doc and Awareness
    const ydoc = new Y.Doc();
    const awareness = new Awareness(ydoc);
    const ytext = ydoc.getText("content");

    // Create SupabaseProvider
    const provider = new SupabaseProvider(
      ydoc,
      awareness,
      "test-channel",
      `User-${Math.floor(Math.random() * 1000)}`,
      "test-doc"
    );

    // Listen to text changes
    const updateContent = () => {
      setContent(ytext.toString());
    };

    // Listen to awareness changes
    const updateAwareness = () => {
      setUsers(Array.from(awareness.getStates().keys()).length);
    };

    // Monitor connection status
    const checkStatus = () => {
      if (provider.isConnected) {
        setStatus(provider.isSynced ? "synced" : "connected");
      } else {
        setStatus("disconnected");
      }
    };

    // Set up listeners
    ytext.observe(updateContent);
    awareness.on("change", updateAwareness);

    // Set up status checking interval
    const statusInterval = setInterval(checkStatus, 1000);

    // Connect the provider
    console.log("🔗 Connecting provider...");
    provider.connect();

    // Initial state
    updateContent();
    updateAwareness();
    checkStatus();

    // Input handler
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const inputHandler = (text: string) => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, text);
    };

    // Cleanup
    return () => {
      clearInterval(statusInterval);
      ytext.unobserve(updateContent);
      awareness.off("change", updateAwareness);
      provider.disconnect();
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);
    // This will trigger the Yjs update which should sync to other clients
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Real-time Collaboration Test</h1>

      <div className="mb-4 p-4 bg-gray-100 rounded">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Status:</strong>
            <span
              className={`ml-2 inline-block w-2 h-2 rounded-full ${
                status === "synced"
                  ? "bg-green-500"
                  : status === "connected"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            ></span>
            {status}
          </div>
          <div>
            <strong>Users:</strong> {users}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Shared Content (type here to test collaboration):
        </label>
        <textarea
          value={content}
          onChange={handleInputChange}
          className="w-full h-32 p-3 border border-gray-300 rounded"
          placeholder="Start typing... Changes should sync in real-time to other browser windows"
        />
      </div>

      <div className="text-sm text-gray-600">
        <p>
          <strong>Instructions:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Open this page in multiple browser windows</li>
          <li>Type in the textarea above</li>
          <li>Watch for changes to appear in other windows</li>
          <li>Check the status and user count above</li>
        </ul>
      </div>
    </div>
  );
}
