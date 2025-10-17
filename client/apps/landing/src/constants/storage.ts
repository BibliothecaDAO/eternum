// Centralized localStorage key helpers

export const STORAGE_KEYS = {
  // Toggle for showing only listed items vs all items in a collection page
  listedOnly: (collectionAddress: string) => `mp:listedOnly:${collectionAddress}`,
  // Toggle for hiding invalid listings (where order owner != token owner)
  hideInvalid: (collectionAddress: string) => `mp:hideInvalid:${collectionAddress}`,
} as const;
