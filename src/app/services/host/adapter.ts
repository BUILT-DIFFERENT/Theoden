import * as automations from "@/app/services/host/automations";
import * as cloudRuns from "@/app/services/host/cloudRuns";
import * as external from "@/app/services/host/external";
import * as persistedState from "@/app/services/host/persistedState";
import * as runtime from "@/app/services/host/runtime";
import * as terminal from "@/app/services/host/terminal";

export interface HostAdapter {
  automations: typeof automations;
  cloudRuns: typeof cloudRuns;
  external: typeof external;
  persistedState: typeof persistedState;
  runtime: typeof runtime;
  terminal: typeof terminal;
}

export const hostAdapter: HostAdapter = Object.freeze({
  automations,
  cloudRuns,
  external,
  persistedState,
  runtime,
  terminal,
});
