"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiClient, API_URL } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import EmailList from "@/components/EmailList";
import ComposePanel from "@/components/ComposePanel";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");
  const [rows, setRows] = useState<any[]>([]);

  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [search, setSearch] = useState("");
  const [slackConnected, setSlackConnected] = useState(false);

  const userEmail = session?.user?.email || "";

  const load = useCallback(async () => {
    if (!userEmail) return;

    setLoading(true);

    try {
      const api = apiClient(userEmail);

      const [current, sched, sent] = await Promise.all([
        api.get(`/api/emails/${tab}`),
        api.get(`/api/emails/scheduled`),
        api.get(`/api/emails/sent`),
      ]);

      setRows(current.data);
      setScheduledCount(sched.data.length);
      setSentCount(sent.data.length);
    } catch (error) {
      console.error("Failed to load emails:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, userEmail]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Elasticsearch-backed live search
  useEffect(() => {
    if (!userEmail) return;

    const api = apiClient(userEmail);

    if (search.trim() === "") {
      load();
      return;
    }

    const timeout = setTimeout(() => {
      api
        .get(
          `/api/emails/search?q=${encodeURIComponent(search)}`
        )
        .then((r) => {
          setRows(r.data);
        })
        .catch((error) => {
          console.error("Search failed:", error);
          setRows([]);
        });
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, userEmail, load]);

  // Check Slack connection status
  useEffect(() => {
    if (!userEmail) return;

    apiClient(userEmail)
      .get(
        `/api/slack/status?email=${encodeURIComponent(
          userEmail
        )}`
      )
      .then((r) => {
        setSlackConnected(r.data.connected);
      })
      .catch((error) => {
        console.error(
          "Unable to check Slack status:",
          error
        );
        setSlackConnected(false);
      });
  }, [userEmail]);

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        userName={session.user?.name || ""}
        userEmail={userEmail}
        userImage={session.user?.image}
        scheduledCount={scheduledCount}
        sentCount={sentCount}
        activeTab={tab}
        onTabChange={setTab}
        onCompose={() => setShowCompose(true)}
      />

      <div className="flex-1 flex flex-col">
        {/* Slack connection */}
        <div className="flex justify-end px-6 pt-3">
          <a
            href={`${API_URL}/api/slack/connect?email=${encodeURIComponent(
              userEmail
            )}`}
            className="text-xs px-3 py-1.5 rounded-full border text-gray-500 hover:bg-gray-50"
          >
            {slackConnected
              ? "Slack: Connected ✅"
              : "Connect Slack"}
          </a>
        </div>

        <EmailList
          rows={rows}
          loading={loading}
          mode={tab}
          search={search}
          onSearchChange={setSearch}
        />
      </div>

      {showCompose && (
        <ComposePanel
          userEmail={userEmail}
          onClose={() => setShowCompose(false)}
          onScheduled={load}
        />
      )}
    </div>
  );
}