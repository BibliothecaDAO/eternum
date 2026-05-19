interface ChunkStreamResubscribeResult {
  outcome: string;
}

export interface RunChunkStreamResubscribeThenRefreshInput {
  resubscribe: (() => Promise<ChunkStreamResubscribeResult | null | undefined>) | null;
  scheduleRefresh: () => void;
  onError?: (error: unknown) => void;
  onResubscribed?: (result: ChunkStreamResubscribeResult | null | undefined) => void;
}

export async function runChunkStreamResubscribeThenRefresh(
  input: RunChunkStreamResubscribeThenRefreshInput,
): Promise<void> {
  if (input.resubscribe) {
    try {
      const result = await input.resubscribe();
      input.onResubscribed?.(result);
    } catch (error) {
      input.onError?.(error);
    }
  }
  input.scheduleRefresh();
}
