import { requestAppServer } from "@/app/services/cli/rpc";

export interface AppInfo {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  installUrl?: string | null;
  isAccessible?: boolean;
}

export interface AppListResponse {
  data: AppInfo[];
  nextCursor: string | null;
}

export async function listApps(params?: {
  cursor?: string | null;
  limit?: number;
}) {
  const result = await requestAppServer<AppListResponse>({
    method: "app/list",
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
