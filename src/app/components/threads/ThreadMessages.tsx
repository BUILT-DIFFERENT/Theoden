import { useEffect, useRef, useState, type ReactNode } from "react";

import type { ThreadMessage } from "@/app/types";

interface TextMessageSegment {
  kind: "text";
  value: string;
}

interface CodeMessageSegment {
  kind: "code";
  value: string;
  language: string | null;
}

type MessageSegment = TextMessageSegment | CodeMessageSegment;

type TextBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { kind: "unordered-list"; items: string[] }
  | { kind: "ordered-list"; items: string[] }
  | { kind: "paragraph"; text: string };

function splitMessageSegments(content: string): MessageSegment[] {
  const fencePattern = /```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g;
  const segments: MessageSegment[] = [];
  let cursor = 0;

  for (const match of content.matchAll(fencePattern)) {
    const raw = match[0];
    const language = match[1] ?? null;
    const code = match[2] ?? "";
    const startIndex = match.index ?? 0;

    if (startIndex > cursor) {
      const textContent = content.slice(cursor, startIndex).trim();
      if (textContent) {
        segments.push({ kind: "text", value: textContent });
      }
    }

    segments.push({
      kind: "code",
      language,
      value: code.replace(/\n$/, ""),
    });

    cursor = startIndex + raw.length;
  }

  if (cursor < content.length) {
    const trailingText = content.slice(cursor).trim();
    if (trailingText) {
      segments.push({ kind: "text", value: trailingText });
    }
  }

  if (!segments.length && content.trim()) {
    segments.push({ kind: "text", value: content.trim() });
  }

  return segments;
}

function parseTextBlocks(content: string): TextBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: TextBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const nextLine = lines[index]?.trim() ?? "";
        if (!/^[-*+]\s+/.test(nextLine)) {
          break;
        }
        items.push(nextLine.replace(/^[-*+]\s+/, "").trim());
        index += 1;
      }
      if (items.length) {
        blocks.push({ kind: "unordered-list", items });
      }
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const nextLine = lines[index]?.trim() ?? "";
        if (!/^\d+\.\s+/.test(nextLine)) {
          break;
        }
        items.push(nextLine.replace(/^\d+\.\s+/, "").trim());
        index += 1;
      }
      if (items.length) {
        blocks.push({ kind: "ordered-list", items });
      }
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const nextLine = lines[index]?.trim() ?? "";
      if (!nextLine) {
        break;
      }
      if (
        /^(#{1,6})\s+/.test(nextLine) ||
        /^[-*+]\s+/.test(nextLine) ||
        /^\d+\.\s+/.test(nextLine)
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    if (paragraphLines.length) {
      blocks.push({
        kind: "paragraph",
        text: paragraphLines.join(" "),
      });
    } else {
      index += 1;
    }
  }

  return blocks;
}

function renderInlineCode(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(/(`[^`]+`)/g)
    .filter((part) => part.length > 0)
    .map((part, index) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={`${keyPrefix}-code-${index}`}
            className="rounded border border-white/10 bg-black/30 px-1 py-0.5 font-mono text-[0.8em] text-ink-100"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={`${keyPrefix}-text-${index}`}>{part}</span>;
    });
}

interface ThreadMessagesProps {
  messages: ThreadMessage[];
}

export function ThreadMessages({ messages }: ThreadMessagesProps) {
  const [copiedSegmentId, setCopiedSegmentId] = useState<string | null>(null);
  const resetCopiedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetCopiedTimeoutRef.current !== null) {
        window.clearTimeout(resetCopiedTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyCode = async (segmentId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSegmentId(segmentId);
      if (resetCopiedTimeoutRef.current !== null) {
        window.clearTimeout(resetCopiedTimeoutRef.current);
      }
      resetCopiedTimeoutRef.current = window.setTimeout(() => {
        setCopiedSegmentId((current) =>
          current === segmentId ? null : current,
        );
      }, 1500);
    } catch (error) {
      console.warn("Failed to copy code block", error);
    }
  };

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
                {segments.map((segment, index) => {
                  const segmentId = `${message.id}-${index}`;
                  if (segment.kind === "code") {
                    return (
                      <div
                        key={segmentId}
                        className="overflow-hidden rounded-xl border border-white/10 bg-black/40"
                      >
                        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[0.65rem] text-ink-400">
                          <span>{segment.language ?? "code"}</span>
                          <button
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] text-ink-200 hover:border-flare-300"
                            onClick={() =>
                              void handleCopyCode(segmentId, segment.value)
                            }
                          >
                            {copiedSegmentId === segmentId ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <pre className="overflow-x-auto p-3 font-mono text-[0.75rem] text-ink-200">
                          <code>{segment.value}</code>
                        </pre>
                      </div>
                    );
                  }

                  const blocks = parseTextBlocks(segment.value);
                  return (
                    <div key={segmentId} className="space-y-3">
                      {blocks.map((block, blockIndex) => {
                        const blockKey = `${segmentId}-block-${blockIndex}`;
                        if (block.kind === "heading") {
                          const headingClass =
                            block.level === 1
                              ? "text-lg font-semibold text-ink-50"
                              : block.level === 2
                                ? "text-base font-semibold text-ink-100"
                                : "text-sm font-semibold text-ink-100";
                          return (
                            <p key={blockKey} className={headingClass}>
                              {renderInlineCode(block.text, blockKey)}
                            </p>
                          );
                        }
                        if (block.kind === "unordered-list") {
                          return (
                            <ul
                              key={blockKey}
                              className="list-disc space-y-1 pl-5 leading-relaxed text-ink-100"
                            >
                              {block.items.map((item, itemIndex) => (
                                <li key={`${blockKey}-item-${itemIndex}`}>
                                  {renderInlineCode(
                                    item,
                                    `${blockKey}-item-${itemIndex}`,
                                  )}
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        if (block.kind === "ordered-list") {
                          return (
                            <ol
                              key={blockKey}
                              className="list-decimal space-y-1 pl-5 leading-relaxed text-ink-100"
                            >
                              {block.items.map((item, itemIndex) => (
                                <li key={`${blockKey}-item-${itemIndex}`}>
                                  {renderInlineCode(
                                    item,
                                    `${blockKey}-item-${itemIndex}`,
                                  )}
                                </li>
                              ))}
                            </ol>
                          );
                        }
                        return (
                          <p
                            key={blockKey}
                            className="leading-relaxed text-ink-100"
                          >
                            {renderInlineCode(block.text, blockKey)}
                          </p>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
