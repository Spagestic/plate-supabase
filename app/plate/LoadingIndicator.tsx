import React from "react";

export function LoadingIndicator({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted mx-auto"></div>
        <p className="mt-2 text-muted-foreground">
          {message || "Loading document..."}
        </p>
      </div>
    </div>
  );
}
