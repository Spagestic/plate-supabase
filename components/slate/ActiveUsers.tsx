import React from "react";
import { ActiveUser } from "@/types/slate";

interface ActiveUsersProps {
  activeUsers: ActiveUser[];
}

export const ActiveUsers: React.FC<ActiveUsersProps> = ({ activeUsers }) => {
  return (
    <div className="flex gap-2 flex-wrap absolute top-4 right-4">
      {activeUsers.map((user, index) => (
        <div
          key={index}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-800 text-neutral-300 text-xs"
        >
          <div className="w-1 h-1 rounded-full bg-green-400"></div>
          <span>{user.username}</span>
        </div>
      ))}
    </div>
  );
};
