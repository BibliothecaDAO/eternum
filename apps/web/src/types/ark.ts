export interface TokenMetadataAttribute {
  display_type?: string;
  trait_type?: string;
  value?: string | number;
}

export interface BridgeRealm {
  token_id: number;
  name?: string;
  attributes?: TokenMetadataAttribute[];
}
