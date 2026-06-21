import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/types/api";
import { useEffect, useRef } from "react";

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <Avatar size="sm">
        <AvatarFallback className="bg-neutral-900 text-white">S</AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-4 py-3">
        <span className="size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
        <span className="size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:150ms]" />
        <span className="size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

type Props = {
  messages: ChatMessage[];
  isTyping: boolean;
};

export function MessageList({ messages, isTyping }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0 || isTyping) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : ""}`}
            >
              <Avatar size="sm" className="mb-0.5 shrink-0">
                <AvatarFallback
                  className={
                    isUser ? "bg-neutral-200 text-neutral-700" : "bg-neutral-900 text-white"
                  }
                >
                  {isUser ? "U" : "S"}
                </AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? "rounded-tr-sm bg-neutral-900 text-white"
                    : "rounded-tl-sm border border-neutral-200 bg-white text-neutral-900"
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </ScrollArea>
  );
}
