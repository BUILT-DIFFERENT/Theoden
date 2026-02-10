import { Check, Copy } from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import type {
  ThreadMessage,
  ThreadMessageActivity,
  ThreadMessageActivityStatus,
} from "@/app/types";

import type { PluggableList } from "unified";

const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    code: [
      ...((defaultSchema.attributes?.code as unknown[]) ?? []),
      ["className"],
    ],
    a: [
      ...((defaultSchema.attributes?.a as unknown[]) ?? []),
      ["href"],
      ["title"],
      ["target"],
      ["rel"],
    ],
  },
};
const markdownRemarkPlugins: PluggableList = [remarkGfm];
const markdownRehypePlugins: PluggableList = [[rehypeSanitize, markdownSchema]];

function sanitizeMarkdownLink(uri: string) {
  const trimmedUri = uri.trim();
  if (!trimmedUri.length) {
    return "";
  }
  if (trimmedUri.startsWith("#") || trimmedUri.startsWith("/")) {
    return trimmedUri;
  }
  try {
    const parsed = new URL(trimmedUri, "https://example.com");
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
      return trimmedUri;
    }
    return "";
  } catch {
    return "";
  }
}

interface ThreadMessagesProps {
  messages: ThreadMessage[];
}

const ACTIVITY_COLLAPSE_LIMIT = 4;

function textFromNode(node: ReactNode): string {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textFromNode).join("");
  }
  return "";
}

function formatActivityStatus(status: ThreadMessageActivityStatus) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "declined") return "Declined";
  return "Running";
}

function formatWorkedDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function activityBadgeClasses(status: ThreadMessageActivityStatus) {
  if (status === "completed") return "border-emerald-400/35 text-emerald-200";
  if (status === "failed") return "border-rose-400/35 text-rose-200";
  if (status === "declined") return "border-amber-400/35 text-amber-200";
  return "border-sky-400/35 text-sky-200";
}

interface ActivityGroupProps {
  messageId: string;
  activities: ThreadMessageActivity[];
  isExpanded: boolean;
  onToggleExpand: (messageId: string) => void;
}

function ActivityGroup({
  messageId,
  activities,
  isExpanded,
  onToggleExpand,
}: ActivityGroupProps) {
  const hiddenCount = Math.max(0, activities.length - ACTIVITY_COLLAPSE_LIMIT);
  const visibleActivities =
    isExpanded || hiddenCount === 0
      ? activities
      : activities.slice(0, ACTIVITY_COLLAPSE_LIMIT);

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-3">
      <header className="mb-2 flex items-center justify-between">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
          Agent activity
        </p>
        {hiddenCount > 0 ? (
          <button
            className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] text-ink-200 hover:border-flare-300"
            onClick={() => onToggleExpand(messageId)}
          >
            {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
          </button>
        ) : null}
      </header>
      <div className="space-y-2">
        {visibleActivities.map((activity) => (
          <div
            key={activity.id}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[0.78rem] text-ink-100">
                <span className="mr-1 uppercase tracking-[0.14em] text-ink-500">
                  Ran
                </span>
                <code className="rounded border border-white/10 bg-black/30 px-1 py-0.5 font-mono text-[0.78rem] text-ink-100">
                  {activity.label}
                </code>
              </p>
              {activity.status ? (
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] ${activityBadgeClasses(activity.status)}`}
                >
                  {formatActivityStatus(activity.status)}
                </span>
              ) : null}
            </div>
            {activity.detail ? (
              <p className="mt-1 truncate text-[0.68rem] text-ink-400">
                {activity.detail}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ThreadMessages({ messages }: ThreadMessagesProps) {
  const [copiedSegmentId, setCopiedSegmentId] = useState<string | null>(null);
  const [expandedActivityMap, setExpandedActivityMap] = useState<
    Record<string, boolean>
  >({});
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
        const isSystem = message.role === "system";
        const hasActivities = Boolean(message.activities?.length);
        let blockIndex = 0;
        const markdownComponents: Components = {
          h1: ({ children, ...props }: ComponentProps<"h1">) => (
            <h1 className="mt-3 text-lg font-semibold text-ink-50" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }: ComponentProps<"h2">) => (
            <h2
              className="mt-3 text-base font-semibold text-ink-100"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }: ComponentProps<"h3">) => (
            <h3 className="mt-3 text-sm font-semibold text-ink-100" {...props}>
              {children}
            </h3>
          ),
          p: ({ children, ...props }: ComponentProps<"p">) => (
            <p className="leading-relaxed text-ink-100" {...props}>
              {children}
            </p>
          ),
          ul: ({ children, ...props }: ComponentProps<"ul">) => (
            <ul className="list-disc space-y-1 pl-5 text-ink-100" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }: ComponentProps<"ol">) => (
            <ol className="list-decimal space-y-1 pl-5 text-ink-100" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }: ComponentProps<"li">) => (
            <li className="leading-relaxed" {...props}>
              {children}
            </li>
          ),
          a: ({ children, ...props }: ComponentProps<"a">) => (
            <a
              {...props}
              className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {children}
            </a>
          ),
          code: ({
            inline,
            className,
            children,
          }: ComponentProps<"code"> & {
            inline?: boolean;
            node?: unknown;
          }) => {
            const codeText = textFromNode(children ?? "").replace(/\n$/, "");
            if (inline) {
              return (
                <code className="rounded border border-white/10 bg-black/30 px-1 py-0.5 font-mono text-[0.8em] text-ink-100">
                  {codeText}
                </code>
              );
            }
            const segmentId = `${message.id}-code-${blockIndex}`;
            blockIndex += 1;
            const language = className?.replace("language-", "") ?? "code";
            return (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[0.65rem] text-ink-400">
                  <span>{language || "code"}</span>
                  <button
                    className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] text-ink-200 hover:border-flare-300"
                    onClick={() => {
                      void handleCopyCode(segmentId, codeText);
                    }}
                  >
                    {copiedSegmentId === segmentId ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="overflow-x-auto p-3 font-mono text-[0.75rem] text-ink-200">
                  <code>{codeText}</code>
                </pre>
              </div>
            );
          },
        };

        const content = message.content.trim();
        const messageCopyId = `${message.id}-message-copy`;
        const isActivityExpanded = Boolean(expandedActivityMap[message.id]);

        const toggleActivityExpansion = () => {
          setExpandedActivityMap((current) => ({
            ...current,
            [message.id]: !current[message.id],
          }));
        };

        return (
          <article key={message.id}>
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                isUser
                  ? "border-flare-300/35 bg-flare-400/10 text-ink-100"
                  : isAssistant
                    ? "border-white/10 bg-black/25 text-ink-100"
                    : "border-white/10 bg-black/15 text-ink-300"
              }`}
            >
              <header className="mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                {isAssistant ? "assistant" : isSystem ? "system" : "you"}
              </header>
              {content ? (
                <div className="space-y-3 text-[0.95rem] leading-7">
                  <ReactMarkdown
                    remarkPlugins={markdownRemarkPlugins}
                    rehypePlugins={markdownRehypePlugins}
                    urlTransform={sanitizeMarkdownLink}
                    components={markdownComponents}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              ) : null}
              {isAssistant && content ? (
                <div className="mt-3 flex justify-end">
                  <button
                    className="rounded-full border border-white/10 p-1.5 text-ink-300 hover:border-flare-300 hover:text-ink-50"
                    aria-label="Copy assistant message"
                    onClick={() => {
                      void handleCopyCode(messageCopyId, content);
                    }}
                  >
                    {copiedSegmentId === messageCopyId ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ) : null}
              {hasActivities ? (
                <ActivityGroup
                  messageId={message.id}
                  activities={message.activities ?? []}
                  isExpanded={isActivityExpanded}
                  onToggleExpand={toggleActivityExpansion}
                />
              ) : null}
              {typeof message.workedDurationMs === "number" &&
              message.workedDurationMs > 0 ? (
                <p className="animate-worked-for-enter mt-3 text-right text-[0.68rem] text-ink-400">
                  Worked for {formatWorkedDuration(message.workedDurationMs)}
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
