"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { apiClient } from "@/lib/api";

type Sender = {
  id: string;
  name: string;
  max_emails_per_hour: number;
};

type Attachment = {
  file: File;
  id: string;
};

function quickOptions() {
  const now = new Date();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const mk = (h: number, m: number) => {
    const d = new Date(tomorrow);
    d.setHours(h, m, 0, 0);
    return d;
  };

  return [
    { label: "Tomorrow, 9:00 AM", date: mk(9, 0) },
    { label: "Tomorrow, 10:00 AM", date: mk(10, 0) },
    { label: "Tomorrow, 11:00 AM", date: mk(11, 0) },
    { label: "Tomorrow, 3:00 PM", date: mk(15, 0) },
  ];
}

export default function ComposePanel({
  userEmail,
  onClose,
  onScheduled,
}: {
  userEmail: string;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const api = apiClient(userEmail);

  const editorRef = useRef<HTMLDivElement>(null);
  const listFileRef = useRef<HTMLInputElement>(null);
  const attachmentRef = useRef<HTMLInputElement>(null);

  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualRecipient, setManualRecipient] = useState("");

  const [delaySeconds, setDelaySeconds] = useState(0);
  const [maxPerHour, setMaxPerHour] = useState(0);

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [showSendLater, setShowSendLater] = useState(false);
  const [pickedTime, setPickedTime] = useState<Date | null>(null);
  const [customTime, setCustomTime] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // LOAD SENDERS
  // --------------------------------------------------

  useEffect(() => {
    api
      .get("/api/emails/senders")
      .then((r) => {
        const senderList: Sender[] = r.data || [];

        setSenders(senderList);

        if (senderList.length > 0) {
          setSenderId(senderList[0].id);
          setMaxPerHour(senderList[0].max_emails_per_hour);
        }
      })
      .catch((err) => {
        console.error("Failed to load senders:", err);
        setError("Unable to load senders.");
      });
  }, []);

  // --------------------------------------------------
  // EDITOR
  // --------------------------------------------------

  function syncBody() {
    const html = editorRef.current?.innerHTML || "";
    setBody(html);
  }

  function execEditorCommand(command: string, value?: string) {
    editorRef.current?.focus();

    document.execCommand(command, false, value);

    syncBody();
  }

  function setEditorAlignment(alignment: string) {
    execEditorCommand(`justify${alignment}`);
  }

  function clearFormatting() {
    execEditorCommand("removeFormat");
  }

  // --------------------------------------------------
  // RECIPIENTS
  // --------------------------------------------------

  function addManualRecipient() {
    const value = manualRecipient.trim();

    if (!value) return;

    if (!value.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setRecipients((prev) =>
      Array.from(new Set([...prev, value]))
    );

    setManualRecipient("");
    setError("");
  }

  function removeRecipient(email: string) {
    setRecipients((prev) =>
      prev.filter((recipient) => recipient !== email)
    );
  }

  function handleRecipientKeyDown(
    e: KeyboardEvent<HTMLInputElement>
  ) {
    if (
      e.key === "Enter" ||
      e.key === "," ||
      e.key === " "
    ) {
      e.preventDefault();
      addManualRecipient();
    }
  }

  // --------------------------------------------------
  // CSV / TXT RECIPIENT LIST
  // --------------------------------------------------

  async function handleListFile(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setError("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post(
        "/api/emails/upload-leads",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const uploadedEmails = res.data?.emails || [];

      setRecipients((prev) =>
        Array.from(
          new Set([...prev, ...uploadedEmails])
        )
      );
    } catch (err) {
      console.error("Upload failed:", err);
      setError(
        "Unable to upload recipient list. Please use CSV or TXT."
      );
    } finally {
      if (listFileRef.current) {
        listFileRef.current.value = "";
      }
    }
  }

  // --------------------------------------------------
  // IMAGE / ATTACHMENT PICKER
  // --------------------------------------------------

  function handleAttachment(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(e.target.files || []);

    if (!files.length) return;

    const newAttachments: Attachment[] = files.map(
      (file) => ({
        file,
        id: `${file.name}-${file.size}-${file.lastModified}`,
      })
    );

    setAttachments((prev) => {
      const existingIds = new Set(
        prev.map((item) => item.id)
      );

      return [
        ...prev,
        ...newAttachments.filter(
          (item) => !existingIds.has(item.id)
        ),
      ];
    });

    if (attachmentRef.current) {
      attachmentRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) =>
      prev.filter((item) => item.id !== id)
    );
  }

  // --------------------------------------------------
  // SCHEDULE / SEND
  // --------------------------------------------------

  async function handleSubmit() {
  setError("");

  const cleanBody =
    editorRef.current?.innerHTML || body;

  const textContent =
    editorRef.current?.textContent?.trim() || "";

  if (
    !senderId ||
    !subject.trim() ||
    !textContent ||
    recipients.length === 0
  ) {
    setError(
      "Please fill subject, body, and add at least one recipient."
    );
    return;
  }

  setSubmitting(true);

  try {
    const formData = new FormData();

    // Basic email information
    formData.append("senderId", senderId);
    formData.append("subject", subject.trim());
    formData.append("body", cleanBody);

    // Scheduling
    formData.append(
      "startTime",
      (pickedTime || new Date()).toISOString()
    );

    formData.append(
      "delaySeconds",
      String(delaySeconds || 5)
    );

    formData.append(
      "maxEmailsPerHour",
      String(maxPerHour || 200)
    );

    // Recipients
    recipients.forEach((email) => {
      formData.append("recipients", email);
    });

    // Attachments
    attachments.forEach((attachment) => {
      formData.append(
        "attachments",
        attachment.file
      );
    });

    await api.post(
      "/api/emails/schedule",
      formData
    );

    onScheduled();
    onClose();
  } catch (e: any) {
    console.error("Schedule failed:", e);

    setError(
      e?.response?.data?.error ||
        "Something went wrong while scheduling the email."
    );
  } finally {
    setSubmitting(false);
  }
}

  // --------------------------------------------------
  // SEND LATER
  // --------------------------------------------------

  const sendLaterLabel = pickedTime
    ? pickedTime.toLocaleString(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Send";

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl flex flex-col">

        {/* ================= HEADER ================= */}

        <div className="flex items-center justify-between gap-3 border-b px-4 sm:px-6 py-4 shrink-0">

          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm sm:text-base font-medium text-gray-700 hover:text-gray-950"
          >
            <span className="text-lg">←</span>
            <span>Compose New Email</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-4">

            {/* Attachment */}

            <button
              type="button"
              onClick={() =>
                attachmentRef.current?.click()
              }
              className="relative h-9 w-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
              title="Attach image"
            >
              <span className="text-xl">📎</span>

              {attachments.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-gray-800 text-white text-[10px] flex items-center justify-center">
                  {attachments.length}
                </span>
              )}
            </button>

            <input
              ref={attachmentRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAttachment}
            />

            {/* Schedule */}

            <div className="relative">

              <button
                type="button"
                onClick={() =>
                  setShowSendLater((value) => !value)
                }
                className="h-9 w-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
                title="Schedule email"
              >
                <span className="text-xl">🕐</span>
              </button>

              {showSendLater && (
                <div className="absolute right-0 top-11 w-[280px] max-w-[calc(100vw-32px)] bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-30">

                  <p className="text-sm font-semibold mb-3">
                    Send Later
                  </p>

                  <input
                    type="datetime-local"
                    value={customTime}
                    onChange={(e) =>
                      setCustomTime(e.target.value)
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-green-500"
                  />

                  <div className="flex flex-col gap-1 mb-3">
                    {quickOptions().map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => {
                          setPickedTime(option.date);
                          setShowSendLater(false);
                        }}
                        className="text-left text-sm px-3 py-2 rounded-lg hover:bg-gray-50"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setShowSendLater(false)
                      }
                      className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (customTime) {
                          setPickedTime(
                            new Date(customTime)
                          );
                        }

                        setShowSendLater(false);
                      }}
                      className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Send */}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="border border-green-500 text-green-600 rounded-full px-4 sm:px-5 py-2 text-sm font-medium hover:bg-green-50 disabled:opacity-50 transition whitespace-nowrap"
            >
              {submitting
                ? "Sending..."
                : pickedTime
                ? sendLaterLabel
                : "Send"}
            </button>
          </div>
        </div>

        {/* ================= FORM ================= */}

        <div className="flex-1 overflow-y-auto">

          <div className="px-4 sm:px-6">

            {/* FROM */}

            <div className="flex items-center gap-3 border-b py-4">

              <span className="text-gray-400 w-12 sm:w-16 text-sm shrink-0">
                From
              </span>

              <select
                value={senderId}
                onChange={(e) => {
                  const selectedId =
                    e.target.value;

                  setSenderId(selectedId);

                  const sender = senders.find(
                    (item) =>
                      item.id === selectedId
                  );

                  if (sender) {
                    setMaxPerHour(
                      sender.max_emails_per_hour
                    );
                  }
                }}
                className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-sm outline-none cursor-pointer hover:bg-gray-100"
              >
                {senders.map((sender) => (
                  <option
                    key={sender.id}
                    value={sender.id}
                  >
                    {sender.name}
                  </option>
                ))}
              </select>
            </div>

            {/* TO */}

            <div className="flex items-start gap-3 border-b py-4">

              <span className="text-gray-400 w-12 sm:w-16 text-sm pt-2 shrink-0">
                To
              </span>

              <div className="flex-1 min-w-0">

                <div className="flex flex-wrap gap-1.5">

                  {recipients.map((email) => (
                    <span
                      key={email}
                      className="max-w-full bg-green-50 text-green-700 text-xs sm:text-sm px-2.5 py-1.5 rounded-full flex items-center gap-1"
                    >
                      <span className="truncate max-w-[180px]">
                        {email}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removeRecipient(email)
                        }
                        className="text-green-500 hover:text-red-600 font-bold shrink-0"
                        title="Remove recipient"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <input
                    value={manualRecipient}
                    onChange={(e) =>
                      setManualRecipient(
                        e.target.value
                      )
                    }
                    onKeyDown={
                      handleRecipientKeyDown
                    }
                    onBlur={addManualRecipient}
                    placeholder="recipient@example.com"
                    className="flex-1 min-w-[150px] outline-none text-sm py-1.5"
                  />
                </div>
              </div>

              {/* Upload List */}

              <button
                type="button"
                onClick={() =>
                  listFileRef.current?.click()
                }
                className="text-green-600 text-sm hover:text-green-700 hover:underline shrink-0 pt-1"
              >
                ↑ Upload List
              </button>

              <input
                ref={listFileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleListFile}
                className="hidden"
              />
            </div>

            {/* SUBJECT */}

            <div className="flex items-center gap-3 border-b py-4">

              <span className="text-gray-400 w-12 sm:w-16 text-sm shrink-0">
                Subject
              </span>

              <input
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value)
                }
                placeholder="Subject"
                className="flex-1 outline-none text-sm"
              />
            </div>

            {/* DELAY + HOURLY LIMIT */}

            <div className="flex flex-wrap items-center gap-4 sm:gap-8 border-b py-4 text-sm">

              <label className="flex items-center gap-2">
                <span className="text-gray-500 whitespace-nowrap">
                  Delay between 2 emails
                </span>

                <input
                  type="number"
                  min="0"
                  value={delaySeconds}
                  onChange={(e) =>
                    setDelaySeconds(
                      Math.max(
                        0,
                        parseInt(
                          e.target.value || "0",
                          10
                        )
                      )
                    )
                  }
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-center outline-none focus:border-green-500"
                />
              </label>

              <label className="flex items-center gap-2">
                <span className="text-gray-500 whitespace-nowrap">
                  Hourly Limit
                </span>

                <input
                  type="number"
                  min="0"
                  value={maxPerHour}
                  onChange={(e) =>
                    setMaxPerHour(
                      Math.max(
                        0,
                        parseInt(
                          e.target.value || "0",
                          10
                        )
                      )
                    )
                  }
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-center outline-none focus:border-green-500"
                />
              </label>
            </div>

            {/* ================= RICH TEXT EDITOR ================= */}

            <div className="mt-4 mb-6 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">

              {/* Toolbar */}

              <div className="flex items-center gap-1 flex-wrap px-3 py-2 bg-white border-b border-gray-200">

                {/* Undo */}

                <button
                  type="button"
                  onClick={() =>
                    execEditorCommand("undo")
                  }
                  className="editor-btn"
                  title="Undo"
                >
                  ↶
                </button>

                {/* Redo */}

                <button
                  type="button"
                  onClick={() =>
                    execEditorCommand("redo")
                  }
                  className="editor-btn"
                  title="Redo"
                >
                  ↷
                </button>

                <span className="toolbar-divider" />

                {/* Bold */}

                <button
                  type="button"
                  onClick={() =>
                    execEditorCommand("bold")
                  }
                  className="editor-btn font-bold"
                  title="Bold"
                >
                  B
                </button>

                {/* Italic */}

                <button
                  type="button"
                  onClick={() =>
                    execEditorCommand("italic")
                  }
                  className="editor-btn italic"
                  title="Italic"
                >
                  I
                </button>

                {/* Underline */}

                <button
                  type="button"
                  onClick={() =>
                    execEditorCommand("underline")
                  }
                  className="editor-btn underline"
                  title="Underline"
                >
                  U
                </button>

                <span className="toolbar-divider" />

                {/* Align left */}

                <button
                  type="button"
                  onClick={() =>
                    setEditorAlignment("Left")
                  }
                  className="editor-btn"
                  title="Align left"
                >
                  ≡
                </button>

                {/* Center */}

                <button
                  type="button"
                  onClick={() =>
                    setEditorAlignment("Center")
                  }
                  className="editor-btn"
                  title="Center"
                >
                  ≣
                </button>

                {/* Right */}

                <button
                  type="button"
                  onClick={() =>
                    setEditorAlignment("Right")
                  }
                  className="editor-btn"
                  title="Align right"
                >
                  ≡
                </button>

                <span className="toolbar-divider" />

                {/* Numbered list */}

                <button
                  type="button"
                  onClick={() =>
                    execEditorCommand(
                      "insertOrderedList"
                    )
                  }
                  className="editor-btn"
                  title="Numbered list"
                >
                  1.
                </button>

                {/* Bullet list */}

                <button
                  type="button"
                  onClick={() =>
                    execEditorCommand(
                      "insertUnorderedList"
                    )
                  }
                  className="editor-btn"
                  title="Bullet list"
                >
                  •
                </button>

                <span className="toolbar-divider" />

                {/* Quote */}

                <button
                  type="button"
                  onClick={() =>
                    execEditorCommand(
                      "formatBlock",
                      "blockquote"
                    )
                  }
                  className="editor-btn"
                  title="Quote"
                >
                  ❝
                </button>

                {/* Clear formatting */}

                <button
                  type="button"
                  onClick={clearFormatting}
                  className="editor-btn text-xs"
                  title="Clear formatting"
                >
                  Tx
                </button>
              </div>

              {/* Editor */}

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncBody}
                data-placeholder="Type Your Reply..."
                className="email-editor min-h-[250px] sm:min-h-[320px] p-4 text-sm outline-none bg-gray-50"
              />
            </div>

            {/* ATTACHMENTS */}

            {attachments.length > 0 && (
              <div className="mb-5">

                <p className="text-sm font-medium text-gray-700 mb-2">
                  Attachments
                </p>

                <div className="flex flex-wrap gap-2">

                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs max-w-full"
                    >
                      <span>📎</span>

                      <span className="truncate max-w-[180px]">
                        {attachment.file.name}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removeAttachment(
                            attachment.id
                          )
                        }
                        className="text-gray-500 hover:text-red-600 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ERROR */}

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor styles */}

      <style jsx>{`
        .editor-btn {
          min-width: 32px;
          height: 32px;
          padding: 0 7px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #555;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .editor-btn:hover {
          background: #f3f4f6;
          color: #111;
        }

        .toolbar-divider {
          width: 1px;
          height: 22px;
          background: #e5e7eb;
          margin: 0 4px;
        }

        .email-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }

        .email-editor blockquote {
          border-left: 3px solid #d1d5db;
          padding-left: 12px;
          margin-left: 4px;
          color: #6b7280;
        }

        .email-editor ul {
          list-style-type: disc;
          padding-left: 24px;
        }

        .email-editor ol {
          list-style-type: decimal;
          padding-left: 24px;
        }
      `}</style>
    </div>
  );
}