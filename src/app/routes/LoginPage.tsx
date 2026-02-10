import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  AccountActionCancelledError,
  cancelPendingChatgptLogin,
  runAccountAction,
} from "@/app/services/cli/accountActions";
import { subscribeAccountLoginCompleted } from "@/app/services/cli/authNotifications";
import { openExternalUrl } from "@/app/services/host/external";
import { isTauri } from "@/app/utils/tauri";

export function LoginPage() {
  const queryClient = useQueryClient();
  const canUseDesktopAuth = isTauri();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<
    "login-chatgpt" | "login-api-key" | "cancel-login" | null
  >(null);
  const [pendingLoginId, setPendingLoginId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAccountLoginCompleted((event) => {
      if (pendingLoginId && event.loginId && event.loginId !== pendingLoginId) {
        return;
      }
      setPendingLoginId(null);
      setActiveAction(null);
      if (event.success) {
        setError(null);
        setMessage("Signed in.");
        void queryClient.invalidateQueries({
          queryKey: ["account", "read"],
        });
        return;
      }
      setMessage(null);
      setError(event.error ?? "Sign-in failed.");
    });
  }, [pendingLoginId, queryClient]);

  const handleAction = async (action: "login-chatgpt" | "login-api-key") => {
    setError(null);
    setMessage(null);
    if (!canUseDesktopAuth) {
      setError("Account sign-in is available in the desktop app runtime.");
      return;
    }
    if (action === "login-chatgpt") {
      setPendingLoginId(null);
    }
    setActiveAction(action);
    try {
      const result = await runAccountAction(action, {
        promptApiKey: () => window.prompt("Enter OpenAI API key"),
        openExternal: (url) => {
          void openExternalUrl(url);
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
          disabled={activeAction !== null || !canUseDesktopAuth}
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
          disabled={activeAction !== null || !canUseDesktopAuth}
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
      {!canUseDesktopAuth ? (
        <p className="mt-2 text-xs text-ink-500">
          Desktop OAuth is unavailable in browser preview mode.
        </p>
      ) : null}
    </section>
  );
}
