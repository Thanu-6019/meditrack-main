"use client";

import { useState, useRef, useEffect } from "react";
import Topbar from "@/components/Topbar";

type MessageRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  type?: "text" | "card" | "list";
  cards?: AssistantCard[];
  listItems?: string[];
}

interface AssistantCard {
  icon: string;
  title: string;
  value: string;
  color: string;
  bg: string;
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  prompt: string;
  color: string;
  bg: string;
}

interface ConversationHistoryItem {
  id: string;
  title: string;
  preview: string;
  date: string;
  icon: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "scan",
    icon: "📷",
    label: "Scan Prescription",
    prompt: "I want to scan a new prescription",
    color: "var(--brand-600)",
    bg: "var(--brand-50)",
  },
  {
    id: "strip",
    icon: "💊",
    label: "Scan Medicine Strip",
    prompt: "Scan my medicine strip to log doses",
    color: "var(--purple)",
    bg: "var(--purple-bg)",
  },
  {
    id: "reminder",
    icon: "⏰",
    label: "Reschedule Reminder",
    prompt: "Help me reschedule my medication reminders",
    color: "var(--warning)",
    bg: "var(--warning-bg)",
  },
  {
    id: "refill",
    icon: "🔄",
    label: "Check Refills",
    prompt: "Which of my medications need a refill soon?",
    color: "var(--info)",
    bg: "var(--info-bg)",
  },
  {
    id: "expiry",
    icon: "📅",
    label: "Check Expiry",
    prompt: "Check expiry dates for all my medications",
    color: "var(--danger)",
    bg: "var(--danger-bg)",
  },
  {
    id: "explain",
    icon: "🔬",
    label: "Explain Medicine",
    prompt: "Explain one of my current medications to me",
    color: "var(--success)",
    bg: "var(--success-bg)",
  },
];

const CONVERSATION_HISTORY: ConversationHistoryItem[] = [
  {
    id: "h1",
    title: "Lisinopril side effects",
    preview: "We discussed the dry cough side effect and alternatives...",
    date: "Yesterday",
    icon: "💊",
  },
  {
    id: "h2",
    title: "Metformin with food",
    preview: "Taking Metformin with meals reduces stomach upset...",
    date: "Jun 6",
    icon: "🍽️",
  },
  {
    id: "h3",
    title: "Blood pressure targets",
    preview: "Your target BP should be below 120/80 mmHg...",
    date: "Jun 4",
    icon: "🩺",
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "init-1",
    role: "assistant",
    content:
      "Hello! 👋 I'm your MediTrack AI health assistant. I can help you understand your medications, check for drug interactions, scan prescriptions, and answer health questions.\n\nWhat would you like help with today?",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: "text",
  },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: "text",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          conversationId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response from AI assistant.");
      }

      const data = await res.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMsg: ChatMessage = {
        id: `msg-res-${Date.now()}`,
        role: "assistant",
        content: data.message?.content || "I couldn't process that request. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: "text",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I ran into an error connecting to the health service. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: "text",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    handleSendMessage(action.prompt);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--n-20)" }}>
      <Topbar title="AI Assistant" />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar History (Hidden on mobile) */}
        <aside style={{
          width: 280,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 16px",
          gap: 20
        }} className="hidden-mobile">
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 12 }}>
              Recent Chats
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CONVERSATION_HISTORY.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSendMessage(`Tell me about ${item.title}`)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 10,
                    borderRadius: "var(--r-md)",
                    border: "none",
                    background: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    width: "100%",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--n-50)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--n-800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                      {item.preview}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Chat Interface */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--surface)" }}>
          {/* Scrollable messages area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                <div style={{
                  maxWidth: "70%",
                  padding: "14px 18px",
                  borderRadius: "var(--r-lg)",
                  background: msg.role === "user" ? "var(--brand-600)" : "var(--n-50)",
                  color: msg.role === "user" ? "white" : "var(--n-800)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  whiteSpace: "pre-line"
                }}>
                  {msg.content}
                  <div style={{
                    fontSize: 10,
                    textAlign: "right",
                    marginTop: 6,
                    color: msg.role === "user" ? "rgba(255,255,255,0.7)" : "var(--muted)"
                  }}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
                <div style={{
                  padding: "14px 18px",
                  borderRadius: "var(--r-lg)",
                  background: "var(--n-50)",
                  color: "var(--muted)",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions (only show at start or as suggestions) */}
          {messages.length === 1 && (
            <div style={{ padding: "0 32px 16px 32px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>
                Suggested Quick Actions:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "transform 0.1s, box-shadow 0.1s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <span style={{
                      fontSize: 18,
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: action.bg,
                      color: action.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      {action.icon}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--n-800)" }}>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div style={{ padding: "20px 32px 32px 32px", borderTop: "1px solid var(--border)" }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputMessage);
              }}
              style={{ display: "flex", gap: 12 }}
            >
              <input
                type="text"
                placeholder="Ask about dosage, interactions, or scan reminders..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "14px 20px",
                  borderRadius: "var(--r-lg)",
                  border: "1px solid var(--border)",
                  fontSize: 14,
                  outline: "none",
                  background: "var(--n-20)",
                  transition: "border-color 0.2s"
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--brand-600)"}
                onBlur={(e) => e.target.style.borderColor = "var(--border)"}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                style={{
                  padding: "0 24px",
                  background: "var(--brand-600)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--r-lg)",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  opacity: (!inputMessage.trim() || isLoading) ? 0.6 : 1,
                  transition: "background 0.2s"
                }}
              >
                Send
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}