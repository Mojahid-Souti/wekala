import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import type { ChatMessage } from "@/types/api";
import { useCallback, useState } from "react";

const MOCK_REPLIES: string[] = [
  "I've checked your workspace — 3 published agents look relevant. Want me to walk you through them?",
  "Got it. What data sources should this agent access? That determines the classification level.",
  "Interesting request. Your audit log shows a similar flow ran last quarter. I can adapt it — shall I?",
  "Let me step through the options. First: what classification level should this agent have?",
];

let replyIndex = 0;

function makeId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const SEED_MESSAGES: ChatMessage[] = [
  {
    id: makeId(),
    role: "assistant",
    content:
      "مرحباً — I'm Sila, your AI concierge. I can help you find agents, draft workflows, review reports, or answer questions about your workspace. How can I help today?",
    timestamp: new Date().toISOString(),
  },
];

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(SEED_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = useCallback((text: string) => {
    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const delay = 600 + Math.random() * 300;
    setTimeout(() => {
      const reply = MOCK_REPLIES[replyIndex % MOCK_REPLIES.length];
      replyIndex += 1;
      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, delay);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50">
      <header className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white select-none">
            ص
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-neutral-900">صِلة · Sila</p>
            <p className="text-xs text-neutral-500">AI Platform Concierge</p>
          </div>
        </div>
      </header>

      <MessageList messages={messages} isTyping={isTyping} />

      <Composer onSend={handleSend} disabled={isTyping} />
    </div>
  );
}
