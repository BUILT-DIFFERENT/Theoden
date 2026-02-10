import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  AccountActionCancelledError,
  cancelPendingChatgptLogin,
  runAccountAction,
} from "@/app/services/cli/accountActions";

export function LoginPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<
    "login-chatgpt" | "login-api-key" | "cancel-login" | null
  >(null);
  const [pendingLoginId, setPendingLoginId] = useState<string | null>(null);

  const handleAction = async (action: "login-chatgpt" | "login-api-key") => {
    setError(null);
    setMessage(null);
    if (action === "login-chatgpt") {
      setPendingLoginId(null);
    }
    setActiveAction(action);
    try {
      const result = await runAccountAction(action, {
        promptApiKey: () => window.prompt("Enter OpenAI API key"),
        openExternal: (url) => {
          window.open(url, "_blank", "noopener,noreferrer");
        },
        refreshAccount: async () => {
          await queryClient.invalidateQueries({
            queryKey: ["account", "read"],
          });
        },
        onChatgptLoginStarted: (loginId) => {
          setPendingLoginId(loginId);
        },
      });
      setMessage(result);
      if (action !== "login-chatgpt") {
        setPendingLoginId(null);
      }
    } catch (actionError) {
      if (actionError instanceof AccountActionCancelledError) {
        setMessage("Login cancelled.");
      } else {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Login request failed.",
        );
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleCancelLogin = async () => {
    if (!pendingLoginId) {
      return;
    }
    setError(null);
    setMessage(null);
    setActiveAction("cancel-login");
    try {
      const result = await cancelPendingChatgptLogin(pendingLoginId);
      setPendingLoginId(null);
      setMessage(result);
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Failed to cancel login.",
      );
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <section className="surface-panel max-w-2xl p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
        Authentication
      </p>
      <h1 className="mt-2 font-display text-2xl text-ink-50">Login</h1>
      <p className="mt-2 text-sm text-ink-300">
        Sign in to enable cloud-backed account capabilities.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-ink-100 hover:border-flare-300 disabled:opacity-60"
          onClick={() => {
            void handleAction("login-chatgpt");
          }}
          disabled={activeAction !== null}
        >
          {activeAction === "login-chatgpt"
            ? "Starting ChatGPT sign-in…"
            : "Sign in with ChatGPT"}
        </button>
        <button
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-ink-100 hover:border-flare-300 disabled:opacity-60"
          onClick={() => {
            void handleAction("login-api-key");
          }}
          disabled={activeAction !== null}
        >
          {activeAction === "login-api-key"
            ? "Checking API key…"
            : "Sign in with API key"}
        </button>
        {pendingLoginId ? (
          <button
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-ink-100 hover:border-flare-300 disabled:opacity-60"
            onClick={() => {
              void handleCancelLogin();
            }}
            disabled={activeAction !== null}
          >
            {activeAction === "cancel-login"
              ? "Cancelling sign-in…"
              : "Cancel sign-in"}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-3 text-sm text-emerald-300">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      <p className="mt-4 text-xs text-ink-400">
        Or continue to <Link to="/">new thread</Link>.
      </p>
    </section>
  );
}
