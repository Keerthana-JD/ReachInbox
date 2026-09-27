"use client";

import { signOut } from "next-auth/react";

export default function Sidebar({
  userName,
  userEmail,
  userImage,
  scheduledCount,
  sentCount,
  activeTab,
  onTabChange,
  onCompose,
}: {
  userName: string;
  userEmail: string;
  userImage?: string | null;
  scheduledCount: number;
  sentCount: number;
  activeTab: "scheduled" | "sent";
  onTabChange: (tab: "scheduled" | "sent") => void;
  onCompose: () => void;
}) {
  return (
    <div className="w-64 shrink-0 border-r bg-white h-screen flex flex-col px-4 py-5">
      <div className="font-black text-xl tracking-tight mb-5">ONB</div>

      {/* User card */}
      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 mb-4">
        {userImage ? (
          <img src={userImage} className="w-8 h-8 rounded-full" alt="" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
            {userName?.[0] || "?"}
          </div>
        )}

        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{userName}</p>
          <p className="text-xs text-gray-400 truncate">{userEmail}</p>
        </div>

        <button
          onClick={() => signOut()}
          title="Logout"
          className="ml-auto text-gray-400 hover:text-gray-700 text-xs"
        >
          ⏻
        </button>
      </div>

      {/* Compose button */}
      <button
        onClick={onCompose}
        className="w-full border border-brand-500 text-brand-600 rounded-full py-2 text-sm font-medium mb-6 hover:bg-brand-50 transition"
      >
        Compose
      </button>

      <p className="text-[11px] font-semibold text-gray-400 tracking-wide mb-2">
        CORE
      </p>

      <nav className="flex flex-col gap-1">
        <button
          onClick={() => onTabChange("scheduled")}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "scheduled"
              ? "bg-brand-50 text-brand-700"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <span className="flex items-center gap-2">
            🕐 Scheduled
          </span>
          <span className="text-xs text-gray-400">{scheduledCount}</span>
        </button>

        <button
          onClick={() => onTabChange("sent")}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "sent"
              ? "bg-brand-50 text-brand-700"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <span className="flex items-center gap-2">
            📤 Sent
          </span>
          <span className="text-xs text-gray-400">{sentCount}</span>
        </button>
      </nav>
    </div>
  );
}