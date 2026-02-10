import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { listModels } from "@/app/services/cli/models";
import { isTauri } from "@/app/utils/tauri";

export interface ModelOption {
  value: string;
  label: string;
  isDefault: boolean;
}

const fallbackModelOptions: ModelOption[] = [
  { value: "gpt-5.2-codex", label: "GPT-5.2 Codex", isDefault: true },
  { value: "gpt-5", label: "GPT-5", isDefault: false },
  { value: "o4-mini", label: "o4-mini", isDefault: false },
];

export function useModels() {
  const enabled = isTauri();
  const query = useQuery({
    queryKey: ["models", "list"],
    queryFn: () => listModels({ limit: 50 }),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: enabled,
  });

  const modelOptions = useMemo(() => {
    const byModel = new Map<string, ModelOption>();
    for (const model of query.data?.data ?? []) {
      const value = model.model.trim();
      if (!value) {
        continue;
      }
      if (byModel.has(value)) {
        continue;
      }
      byModel.set(value, {
        value,
        label: model.displayName.trim() || model.model,
        isDefault: model.isDefault === true,
      });
    }

    const fromApi = Array.from(byModel.values()).sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });
    if (fromApi.length) {
      return fromApi;
    }
    return fallbackModelOptions;
  }, [query.data?.data]);

  return {
    modelOptions,
    isLoading: enabled ? query.isPending : false,
    error: query.error,
    refresh: query.refetch,
  };
}
