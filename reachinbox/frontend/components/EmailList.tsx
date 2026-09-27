"use client";

import { useState } from "react";

type Row = {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  scheduled_time?: string;
  sent_time?: string;
  body?: string;
};

function formatDateTime(iso?: string) {
  if (!iso) return "";

  const d = new Date(iso);

  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortTime(iso?: string) {
  if (!iso) return "";

  const d = new Date(iso);

  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EmailList({
  rows,
  loading,
  mode,
  search,
  onSearchChange,
}: {
  rows: Row[];
  loading: boolean;
  mode: "scheduled" | "sent";
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const [selectedEmail, setSelectedEmail] = useState<Row | null>(null);

  /*
   * EMAIL DETAIL VIEW
   * This matches the Figma flow where clicking an email
   * opens the complete email conversation/detail screen.
   */
  if (selectedEmail) {
    const date =
      mode === "scheduled"
        ? selectedEmail.scheduled_time
        : selectedEmail.sent_time;

    return (
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {/* Detail header */}
        <div className="h-[58px] border-b flex items-center px-5">
          <button
            onClick={() => setSelectedEmail(null)}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-black"
          >
            <span className="text-lg">←</span>
            <span>{selectedEmail.subject || "Email"}</span>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {selectedEmail.status}
            </span>

            <button
              onClick={() => setSelectedEmail(null)}
              className="text-gray-400 hover:text-gray-700 text-lg"
            >
              ×
            </button>
          </div>
        </div>

        {/* Email content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-7">
            {/* Subject */}
            <h1 className="text-xl font-semibold text-gray-900 mb-5">
              {selectedEmail.subject || "(No subject)"}
            </h1>

            {/* Sender / recipient information */}
            <div className="flex items-start gap-3 pb-5 border-b">
              <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold shrink-0">
                {selectedEmail.recipient_email?.[0]?.toUpperCase() || "?"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    To: {selectedEmail.recipient_email}
                  </p>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      selectedEmail.status === "sent"
                        ? "bg-green-100 text-green-700"
                        : selectedEmail.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {selectedEmail.status}
                  </span>
                </div>

                {date && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateTime(date)}
                  </p>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="pt-7">
              <div className="text-[14px] leading-7 text-gray-800 whitespace-pre-wrap break-words">
                {selectedEmail.body || "No email body."}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /*
   * EMAIL LIST VIEW
   */
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* Search bar */}
      <div className="h-[58px] border-b px-6 flex items-center gap-3">
        <span className="text-xl">🔍</span>

        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder:text-gray-400"
        />

        <button
          onClick={() => onSearchChange("")}
          className="text-gray-400 hover:text-gray-700 text-sm"
          title="Refresh"
        >
          ⟳
        </button>
      </div>

      {/* Email rows */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-24 text-center text-gray-400 text-sm">
            No {mode} emails yet.
          </div>
        ) : (
          rows.map((r) => {
            const date =
              mode === "scheduled"
                ? r.scheduled_time
                : r.sent_time;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedEmail(r)}
                className="w-full text-left flex items-center gap-4 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
              >
                {/* Recipient */}
                <div className="w-[170px] shrink-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    To: {r.recipient_email}
                  </p>
                </div>

                {/* Time */}
                <span
                  className={`text-[11px] px-2.5 py-1 rounded-full shrink-0 ${
                    r.status === "sent"
                      ? "bg-green-100 text-green-700"
                      : r.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {formatShortTime(date)}
                </span>

                {/* Subject + preview */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    <span className="font-semibold text-gray-800">
                      {r.subject || "(No subject)"}
                    </span>

                    {r.body && (
                      <span className="text-gray-400">
                        {" "}
                        — {r.body.replace(/\s+/g, " ").slice(0, 80)}
                      </span>
                    )}
                  </p>
                </div>

                {/* Status */}
                <span className="text-[11px] text-gray-400 shrink-0">
                  {r.status}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}