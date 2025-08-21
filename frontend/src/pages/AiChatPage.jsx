import React, { useEffect, useRef, useState } from "react";
import { aiApi } from "../utils/api";
import Navbar from "../components/Navbar";
import "../styles/main.css";

function AIChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setError("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    try {
      const res = await aiApi.post("/chat", { message: text });
      const reply = res.data?.reply || "";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Request failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold mb-4">AI Health Assistant</h1>
        <div className="bg-white rounded-lg shadow p-4 h-[70vh] flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 && (
              <div className="text-gray-500 text-sm">
                Start a conversation. If signed in, your chat is saved and
                summarized over time. Otherwise, a temporary session is used via
                cookies.
              </div>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={m.role === "user" ? "text-right" : "text-left"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "inline-block bg-blue-600 text-white px-3 py-2 rounded-lg"
                      : "inline-block bg-gray-200 text-gray-900 px-3 py-2 rounded-lg"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-gray-500 text-sm">Assistant is typing…</div>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={sendMessage} className="mt-3 flex gap-2">
            <input
              type="text"
              className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none"
              placeholder="Ask a health question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={loading}
            >
              Send
            </button>
          </form>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        </div>
      </div>
    </div>
  );
}

export default AIChatPage;
