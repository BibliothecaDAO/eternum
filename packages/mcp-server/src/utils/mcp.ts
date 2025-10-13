export function jsonResource(uri: URL, data: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  } as const;
}

export function errorResponse(message: string) {
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
  };
}

export function formatTransactionHash(receipt: unknown): string | undefined {
  if (!receipt || typeof receipt !== "object") {
    return undefined;
  }

  const maybeReceipt = receipt as Record<string, unknown>;
  const hash = maybeReceipt["transaction_hash"] ?? maybeReceipt["transactionHash"];
  return typeof hash === "string" ? hash : undefined;
}
