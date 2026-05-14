export const FACTORY_V2_WORKFLOW_REF_STORAGE_KEY = "factory-v2-workflow-ref";

type StorageReader = Pick<Storage, "getItem">;

function resolveFactoryWorkflowRefStorage(): StorageReader | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeWorkflowRef(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function resolveFactoryV2WorkflowRef({
  isDev = import.meta.env.DEV,
  storage = resolveFactoryWorkflowRefStorage(),
  envWorkflowRef = import.meta.env.VITE_PUBLIC_FACTORY_WORKFLOW_REF,
}: {
  isDev?: boolean;
  storage?: StorageReader | null;
  envWorkflowRef?: string | undefined;
} = {}): string | undefined {
  if (!isDev) {
    return undefined;
  }

  try {
    return (
      normalizeWorkflowRef(storage?.getItem(FACTORY_V2_WORKFLOW_REF_STORAGE_KEY)) ??
      normalizeWorkflowRef(envWorkflowRef)
    );
  } catch {
    return normalizeWorkflowRef(envWorkflowRef);
  }
}
