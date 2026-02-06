import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  APP_MENU_GROUPS,
  type MenuCommandId,
  type MenuTopLevelId,
} from "@/app/services/menu/menuCommands";
import { isTauri } from "@/app/utils/tauri";

interface WindowTitlebarProps {
  onCommand: (command: MenuCommandId) => Promise<void> | void;
}

export function WindowTitlebar({ onCommand }: WindowTitlebarProps) {
  const [openMenu, setOpenMenu] = useState<MenuTopLevelId | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const titlebarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    let disposed = false;
    let detachResize: (() => void) | undefined;

    const syncMaximized = async () => {
      try {
        const maximized = await getCurrentWindow().isMaximized();
        if (!disposed) {
          setIsMaximized(maximized);
        }
      } catch {
        if (!disposed) {
          setIsMaximized(false);
        }
      }
    };

    void syncMaximized();
    void getCurrentWindow()
      .onResized(() => {
        void syncMaximized();
      })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        detachResize = unlisten;
      });

    return () => {
      disposed = true;
      detachResize?.();
    };
  }, []);

  useEffect(() => {
    if (!openMenu) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (titlebarRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpenMenu(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openMenu]);

  const runCommand = async (command: MenuCommandId) => {
    setOpenMenu(null);
    await onCommand(command);
  };

  return (
    <header
      className="relative z-50 flex h-10 items-stretch border-b border-white/10 bg-ink-950/80 px-2 text-xs text-ink-200 backdrop-blur select-none"
      ref={titlebarRef}
    >
      <div className="flex items-stretch gap-1">
        {APP_MENU_GROUPS.map((group) => (
          <div
            className="relative flex items-stretch"
            key={group.id}
            onMouseEnter={() => {
              if (openMenu) {
                setOpenMenu(group.id);
              }
            }}
          >
            <button
              className={
                openMenu === group.id
                  ? "rounded-md bg-white/15 px-3 text-ink-50"
                  : "rounded-md px-3 text-ink-300 hover:bg-white/10 hover:text-ink-50"
              }
              onClick={() =>
                setOpenMenu((current) =>
                  current === group.id ? null : group.id,
                )
              }
            >
              {group.label}
            </button>
            {openMenu === group.id ? (
              <div className="surface-panel absolute left-0 top-[calc(100%+6px)] z-50 min-w-56 p-1">
                {group.entries.map((entry, index) =>
                  entry.kind === "separator" ? (
                    <div
                      className="my-1 h-px bg-white/10"
                      key={`separator-${index}`}
                    />
                  ) : (
                    <button
                      className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[0.72rem] text-ink-100 hover:bg-white/[0.08]"
                      key={entry.id}
                      onClick={() => {
                        void runCommand(entry.id);
                      }}
                    >
                      <span>{entry.label}</span>
                      {entry.accelerator ? (
                        <span className="ml-6 text-[0.65rem] text-ink-500">
                          {entry.accelerator}
                        </span>
                      ) : null}
                    </button>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex-1" data-tauri-drag-region />

      <div className="ml-2 flex items-stretch gap-1">
        <button
          className="rounded-md px-2 text-ink-300 hover:bg-white/10 hover:text-ink-50"
          onClick={() => {
            void runCommand("window-minimize");
          }}
          title="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          className="rounded-md px-2 text-ink-300 hover:bg-white/10 hover:text-ink-50"
          onClick={() => {
            void runCommand("window-toggle-maximize");
          }}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          className="rounded-md px-2 text-ink-300 hover:bg-rose-500/35 hover:text-ink-50"
          onClick={() => {
            void runCommand("window-close");
          }}
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
