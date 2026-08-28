export interface CosmeticMetadataAttribute {
  trait_type: string;
  value: string;
}

export interface CosmeticMetadata {
  attributes?: CosmeticMetadataAttribute[];
  description?: string;
  image?: string;
  name?: string;
}

export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  modelPath: string;
  metadata?: CosmeticMetadata | null;
  tokenSymbol?: string;
  balance?: string;
  attributes?: CosmeticMetadataAttribute[];
  image?: string | null;
  tokenId?: string | null;
  slot?: string | null;
  count?: number;
  attributesRaw?: string;
}
