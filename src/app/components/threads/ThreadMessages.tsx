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

import type { ThreadMessage } from "@/app/types";

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
              <div className="space-y-3">
                <ReactMarkdown
                  remarkPlugins={markdownRemarkPlugins}
                  rehypePlugins={markdownRehypePlugins}
                  urlTransform={sanitizeMarkdownLink}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
