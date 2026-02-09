import { requestAppServer } from "@/app/services/cli/rpc";

export interface AppServerModelReasoningEffort {
  effort: string;
  description?: string;
}

export interface AppServerModel {
  id: string;
  model: string;
  displayName: string;
  description?: string;
  defaultReasoningEffort?: string;
  reasoningEffort: AppServerModelReasoningEffort[];
  supportsPersonality?: boolean;
  isDefault?: boolean;
}

export interface ModelListResponse {
  data: AppServerModel[];
  nextCursor: string | null;
}

export interface CollaborationModeListResponse {
  data: Array<Record<string, unknown>>;
  nextCursor: string | null;
}

export async function listModels(params?: {
  cursor?: string | null;
  limit?: number;
}) {
  const result = await requestAppServer<ModelListResponse>({
    method: "model/list",
    params: {
      cursor: params?.cursor ?? null,
      limit: params?.limit ?? null,
    },
  });
  return (
    result ?? {
      data: [],
      nextCursor: null,
    }
  );
}

export async function listCollaborationModes(params?: {
  cursor?: string | null;
  limit?: number;
}) {
  const result = await requestAppServer<CollaborationModeListResponse>({
    method: "collaborationMode/list",
    params: {
      cursor: params?.cursor ?? null,
      limit: params?.limit ?? null,
    },
  });
  return (
    result ?? {
      data: [],
      nextCursor: null,
    }
  );
}
