/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";

interface CollaborationDebugProps {
  provider: any;
  ydoc: any;
  awareness: any;
}

export function CollaborationDebug({
  provider,
  ydoc,
  awareness,
}: CollaborationDebugProps) {
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [userCount, setUserCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const addLog = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev.slice(-9), `${timestamp}: ${message}`]);
    };

    // Monitor connection status
    const checkStatus = () => {
      if (provider && provider.channel) {
        setConnectionStatus(provider.isSynced ? "synced" : "connected");
      } else {
        setConnectionStatus("disconnected");
      }
    };

    // Monitor awareness changes
    const onAwarenessChange = () => {
      if (awareness) {
        const users = Array.from(awareness.getStates().keys()).length;
        setUserCount(users);
        addLog(`Users online: ${users}`);
      }
    };

    // Monitor document changes
    const onDocUpdate = () => {
      addLog("Document updated");
    };

    // Set up intervals and listeners
    const statusInterval = setInterval(checkStatus, 1000);
    awareness?.on("change", onAwarenessChange);
    ydoc?.on("update", onDocUpdate);

    // Initial check
    checkStatus();
    onAwarenessChange();

    return () => {
      clearInterval(statusInterval);
      awareness?.off("change", onAwarenessChange);
      ydoc?.off("update", onDocUpdate);
    };
  }, [provider, ydoc, awareness]);

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg font-mono text-xs max-w-sm z-50">
      <div className="mb-2">
        <strong>Collaboration Status</strong>
      </div>
      <div className="mb-1">
        Status:{" "}
        <span
          className={`inline-block w-2 h-2 rounded-full mr-2 ${
            connectionStatus === "synced"
              ? "bg-green-500"
              : connectionStatus === "connected"
              ? "bg-yellow-500"
              : "bg-red-500"
          }`}
        ></span>
        {connectionStatus}
      </div>
      <div className="mb-2">Users: {userCount}</div>
      <div className="text-xs">
        <strong>Recent Activity:</strong>
        <div className="max-h-24 overflow-y-auto mt-1">
          {logs.map((log, i) => (
            <div key={i} className="text-gray-300">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
