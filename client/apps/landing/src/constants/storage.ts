// Centralized localStorage key helpers

export const STORAGE_KEYS = {
  // Toggle for showing only listed items vs all items in a collection page
  listedOnly: (collectionAddress: string) => `mp:listedOnly:${collectionAddress}`,
} as const;

