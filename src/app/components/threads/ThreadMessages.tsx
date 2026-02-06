import type { ThreadMessage } from "@/app/types";

interface MessageSegment {
  kind: "text" | "code";
  value: string;
}

function splitMessageSegments(content: string): MessageSegment[] {
  const parts = content.split("```");
  return parts
    .map((part, index) => ({
      kind: index % 2 === 0 ? "text" : "code",
      value: part.trim(),
    }))
    .filter((part) => part.value.length > 0);
}

interface ThreadMessagesProps {
  messages: ThreadMessage[];
}

export function ThreadMessages({ messages }: ThreadMessagesProps) {
  if (!messages.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-ink-400">
        No messages yet. Ask for follow-up changes.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isUser = message.role === "user";
        const isAssistant = message.role === "assistant";
        const segments = splitMessageSegments(message.content);
        return (
          <div
            key={message.id}
            className={isUser ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm ${
                isUser
                  ? "border-flare-300/40 bg-flare-400/10 text-ink-100"
                  : isAssistant
                    ? "border-white/10 bg-black/30 text-ink-100"
                    : "border-white/10 bg-black/20 text-ink-300"
              }`}
            >
              <p className="mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                {message.role}
              </p>
              <div className="space-y-2">
                {segments.map((segment, index) =>
                  segment.kind === "code" ? (
                    <pre
                      key={`${message.id}-${index}`}
                      className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[0.75rem] text-ink-200"
                    >
                      <code>{segment.value}</code>
                    </pre>
                  ) : (
                    <p
                      key={`${message.id}-${index}`}
                      className="whitespace-pre-wrap leading-relaxed"
                    >
                      {segment.value}
                    </p>
                  ),
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
