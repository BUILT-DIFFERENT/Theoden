import { useEffect, useState } from "react";

export type CommandPermissionProfile =
  | "read-only"
  | "workspace-write"
  | "full-access";

export interface PermissionProfileOption {
  id: CommandPermissionProfile;
  label: string;
  description: string;
}

const STORAGE_KEY = "codex.command.permissionProfile";
const listeners = new Set<(profile: CommandPermissionProfile) => void>();

export const permissionProfileOptions: PermissionProfileOption[] = [
  {
    id: "workspace-write",
    label: "Workspace write",
    description: "Read/write in workspace with normal safety defaults.",
  },
  {
    id: "read-only",
    label: "Read only",
    description: "Read workspace data without write-side command intent.",
  },
  {
    id: "full-access",
    label: "Full access",
    description: "Permit commands that may modify broader system state.",
  },
];

function defaultProfile(): CommandPermissionProfile {
  return "workspace-write";
}

function parseProfile(value: unknown): CommandPermissionProfile {
  if (value === "read-only") {
    return "read-only";
  }
  if (value === "full-access") {
    return "full-access";
  }
  return "workspace-write";
}

export function getCommandPermissionProfile(): CommandPermissionProfile {
  if (typeof window === "undefined") {
    return defaultProfile();
  }
  return parseProfile(window.localStorage.getItem(STORAGE_KEY));
}

export function setCommandPermissionProfile(profile: CommandPermissionProfile) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, profile);
  }
  listeners.forEach((listener) => listener(profile));
}

export function subscribeCommandPermissionProfile(
  listener: (profile: CommandPermissionProfile) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function sandboxPolicyForProfile(profile: CommandPermissionProfile) {
  if (profile === "read-only") {
    return {
      mode: "read_only",
      filesystem: "read_only",
      network: "restricted",
    };
  }
  if (profile === "full-access") {
    return {
      mode: "full_access",
      filesystem: "full_access",
      network: "allow",
    };
  }
  return {
    mode: "workspace_write",
    filesystem: "workspace_write",
    network: "restricted",
  };
}

export function useCommandPermissionProfile() {
  const [profile, setProfile] = useState<CommandPermissionProfile>(() =>
    getCommandPermissionProfile(),
  );

  useEffect(() => {
    setProfile(getCommandPermissionProfile());
    return subscribeCommandPermissionProfile((nextProfile) => {
      setProfile(nextProfile);
    });
  }, []);

  const setAndPersist = (nextProfile: CommandPermissionProfile) => {
    setCommandPermissionProfile(nextProfile);
  };

  return {
    profile,
    setProfile: setAndPersist,
  };
}
