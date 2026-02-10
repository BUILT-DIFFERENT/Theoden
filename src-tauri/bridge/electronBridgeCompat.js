(() => {
  const WINDOW_TYPE = "electron";
  const APP_CHANNEL = "codex_desktop:message-for-view";

  const tauriCore = window.__TAURI__?.core;
  const tauriEvent = window.__TAURI__?.event;

  if (!tauriCore?.invoke || !tauriEvent?.listen) {
    console.error(
      "[electronBridgeCompat] Tauri APIs are unavailable; bridge disabled.",
    );
    return;
  }

  const workerSubscriptions = new Map();
  const workerEventUnsubscribers = new Map();
  let appMessageUnsubscribe = null;
  let sentryInitOptions = {
    codexAppSessionId: "tauri-session",
    buildFlavor: "dev",
    buildNumber: null,
    appVersion: "0.0.0",
  };
  let buildFlavor = "tauri";

  function normalizeBuildFlavor(value) {
    if (typeof value === "string") {
      return value;
    }
    if (
      value &&
      typeof value === "object" &&
      typeof value.flavor === "string"
    ) {
      return value.flavor;
    }
    return "tauri";
  }

  async function bootstrapMetadata() {
    try {
      const sentry = await tauriCore.invoke("bridge_get_sentry_init_options");
      if (sentry && typeof sentry === "object") {
        sentryInitOptions = sentry;
      }
    } catch (error) {
      console.warn(
        "[electronBridgeCompat] Failed to load sentry init options",
        error,
      );
    }

    try {
      const flavor = await tauriCore.invoke("bridge_get_build_flavor");
      buildFlavor = normalizeBuildFlavor(flavor);
    } catch (error) {
      console.warn("[electronBridgeCompat] Failed to load build flavor", error);
    }
  }

  async function ensureAppMessageSubscription() {
    if (!appMessageUnsubscribe) {
      const listenPromise = tauriEvent
        .listen(APP_CHANNEL, (event) => {
          window.dispatchEvent(
            new MessageEvent("message", {
              data: event.payload,
            }),
          );
        })
        .then((unlisten) => {
          if (appMessageUnsubscribe === listenPromise) {
            appMessageUnsubscribe = unlisten;
          } else {
            void unlisten();
          }
          return unlisten;
        })
        .catch((error) => {
          if (appMessageUnsubscribe === listenPromise) {
            appMessageUnsubscribe = null;
          }
          throw error;
        });
      appMessageUnsubscribe = listenPromise;
    }

    if (typeof appMessageUnsubscribe === "function") {
      return;
    }
    await appMessageUnsubscribe;
  }

  const electronBridge = {
    windowType: WINDOW_TYPE,
    sendMessageFromView: async (payload) => {
      await ensureAppMessageSubscription();
      await tauriCore.invoke("bridge_send_message_from_view", { payload });
    },
    getPathForFile: (input) => {
      if (!input) return null;
      if (typeof input === "string") return input;
      if (typeof input.path === "string" && input.path.length > 0) {
        return input.path;
      }
      return null;
    },
    sendWorkerMessageFromView: async (workerId, payload) => {
      await tauriCore.invoke("bridge_send_worker_message_from_view", {
        workerId,
        payload,
      });
    },
    subscribeToWorkerMessages: (workerId, callback) => {
      if (!workerSubscriptions.has(workerId)) {
        workerSubscriptions.set(workerId, new Set());
      }
      const callbackSet = workerSubscriptions.get(workerId);
      callbackSet.add(callback);

      const maybeSubscribe = async () => {
        const existing = workerEventUnsubscribers.get(workerId);
        if (existing) {
          await Promise.resolve(existing);
          return;
        }
        const channel = `codex_desktop:worker:${workerId}:for-view`;
        const listenPromise = tauriEvent
          .listen(channel, (event) => {
            const callbacks = workerSubscriptions.get(workerId);
            if (!callbacks) {
              return;
            }
            callbacks.forEach((handler) => {
              try {
                handler(event.payload);
              } catch (error) {
                console.error(
                  "[electronBridgeCompat] worker callback failed",
                  error,
                );
              }
            });
          })
          .then((unlisten) => {
            if (workerEventUnsubscribers.get(workerId) === listenPromise) {
              workerEventUnsubscribers.set(workerId, unlisten);
            } else {
              void unlisten();
            }
            return unlisten;
          })
          .catch((error) => {
            if (workerEventUnsubscribers.get(workerId) === listenPromise) {
              workerEventUnsubscribers.delete(workerId);
            }
            throw error;
          });
        workerEventUnsubscribers.set(workerId, listenPromise);
        await listenPromise;
      };

      void maybeSubscribe().catch((error) => {
        console.error(
          "[electronBridgeCompat] failed to subscribe worker events",
          error,
        );
      });

      return () => {
        const handlers = workerSubscriptions.get(workerId);
        if (!handlers) {
          return;
        }
        handlers.delete(callback);
        if (handlers.size > 0) {
          return;
        }
        workerSubscriptions.delete(workerId);
        const unlistenEntry = workerEventUnsubscribers.get(workerId);
        if (unlistenEntry) {
          workerEventUnsubscribers.delete(workerId);
          void Promise.resolve(unlistenEntry)
            .then((unlisten) => {
              if (typeof unlisten === "function") {
                return unlisten();
              }
              return undefined;
            })
            .catch((error) => {
              console.error(
                "[electronBridgeCompat] failed to unsubscribe worker events",
                error,
              );
            });
        }
      };
    },
    showContextMenu: async (payload) => {
      await tauriCore.invoke("bridge_show_context_menu", { payload });
    },
    triggerSentryTestError: async () => {
      await tauriCore.invoke("bridge_trigger_sentry_test");
    },
    getSentryInitOptions: () => sentryInitOptions,
    getAppSessionId: () => sentryInitOptions.codexAppSessionId,
    getBuildFlavor: () => buildFlavor,
  };

  window.codexWindowType = WINDOW_TYPE;
  window.electronBridge = electronBridge;
  void bootstrapMetadata();
})();
