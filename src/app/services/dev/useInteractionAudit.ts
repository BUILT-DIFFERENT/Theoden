import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const CLICKABLE_SELECTOR =
  "button, a, [role='button'], [data-ui-clickable='true']";
const DEAD_ACTION_ATTR = "data-ui-audit-dead-action";
const IGNORE_AUDIT_ATTR = "data-ui-audit-ignore";
const CLICK_HANDLER_KEYS = [
  "onClick",
  "onMouseDown",
  "onPointerDown",
  "onKeyDown",
] as const;

function getReactProps(element: Element): Record<string, unknown> | null {
  const candidate = element as unknown as Record<string, unknown>;
  const reactPropsKey = Object.keys(candidate).find((key) =>
    key.startsWith("__reactProps$"),
  );
  if (!reactPropsKey) {
    return null;
  }
  const props = candidate[reactPropsKey];
  if (!props || typeof props !== "object") {
    return null;
  }
  return props as Record<string, unknown>;
}

function hasClickHandler(element: Element): boolean {
  const reactProps = getReactProps(element);
  if (reactProps) {
    for (const key of CLICK_HANDLER_KEYS) {
      if (typeof reactProps[key] === "function") {
        return true;
      }
    }
  }
  const htmlElement = element as HTMLElement;
  return (
    typeof htmlElement.onclick === "function" ||
    htmlElement.hasAttribute("onclick")
  );
}

function hasDeclarativeAction(element: Element): boolean {
  if (element.hasAttribute(IGNORE_AUDIT_ATTR)) {
    return true;
  }
  if (element.getAttribute("aria-disabled") === "true") {
    return true;
  }
  if (element instanceof HTMLButtonElement) {
    if (element.disabled) {
      return true;
    }
    const type = element.getAttribute("type") ?? "submit";
    if ((type === "submit" || type === "reset") && element.form) {
      return true;
    }
  }
  if (element instanceof HTMLAnchorElement) {
    const href = element.getAttribute("href");
    if (href && href !== "#" && !href.startsWith("javascript:")) {
      return true;
    }
  }
  return false;
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.pointerEvents === "none"
  ) {
    return false;
  }
  if (style.position === "fixed") {
    return true;
  }
  return element.offsetParent !== null;
}

function isActionable(element: Element): boolean {
  return hasDeclarativeAction(element) || hasClickHandler(element);
}

function describeElement(element: Element): string {
  const htmlElement = element as HTMLElement;
  const text = (htmlElement.textContent ?? "").replace(/\s+/g, " ").trim();
  const shortText = text.length > 40 ? `${text.slice(0, 40)}…` : text;
  const idPart = htmlElement.id ? `#${htmlElement.id}` : "";
  const rolePart = htmlElement.getAttribute("role")
    ? `[role=${htmlElement.getAttribute("role")}]`
    : "";
  const label =
    htmlElement.getAttribute("aria-label") ??
    htmlElement.getAttribute("title") ??
    shortText;
  return `${element.tagName.toLowerCase()}${idPart}${rolePart}${label ? ` "${label}"` : ""}`;
}

function clearDeadActionMarkers() {
  document
    .querySelectorAll(`[${DEAD_ACTION_ATTR}="true"]`)
    .forEach((element) => element.removeAttribute(DEAD_ACTION_ATTR));
}

function scanForDeadActions() {
  clearDeadActionMarkers();
  document.querySelectorAll(CLICKABLE_SELECTOR).forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    if (!isVisible(element)) {
      return;
    }
    if (isActionable(element)) {
      return;
    }
    element.setAttribute(DEAD_ACTION_ATTR, "true");
  });
}

export function useInteractionAudit() {
  const location = useLocation();
  const currentRoute = location.pathname;
  const routeRef = useRef(currentRoute);
  const auditEnabled = import.meta.env.DEV;
  const smokeModeEnabled =
    auditEnabled && import.meta.env.VITE_UI_SMOKE_TEST === "1";

  useEffect(() => {
    if (!auditEnabled) {
      return;
    }
    if (routeRef.current !== currentRoute) {
      console.warn("[ui-audit] route", {
        from: routeRef.current,
        to: currentRoute,
      });
      routeRef.current = currentRoute;
    }
    if (smokeModeEnabled) {
      window.requestAnimationFrame(() => {
        scanForDeadActions();
      });
    }
  }, [auditEnabled, currentRoute, smokeModeEnabled]);

  useEffect(() => {
    if (!auditEnabled) {
      return;
    }
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const clickable = target.closest(CLICKABLE_SELECTOR);
      if (!clickable) {
        return;
      }
      const handled = isActionable(clickable);
      console.warn("[ui-audit] click", {
        route: routeRef.current,
        element: describeElement(clickable),
        handled,
      });
    };
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [auditEnabled]);

  useEffect(() => {
    if (!smokeModeEnabled) {
      clearDeadActionMarkers();
      return;
    }
    let rafId = 0;
    const scheduleScan = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        scanForDeadActions();
      });
    };
    const observer = new MutationObserver(() => {
      scheduleScan();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "class",
        "disabled",
        "aria-disabled",
        "href",
        "role",
        "style",
      ],
    });
    window.addEventListener("resize", scheduleScan);
    scheduleScan();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleScan);
      window.cancelAnimationFrame(rafId);
      clearDeadActionMarkers();
    };
  }, [smokeModeEnabled]);
}
