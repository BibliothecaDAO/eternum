export interface WorldManifestLike {
  address?: string;
}

export interface ContractManifestLike {
  address?: string;
  selector?: string;
  tag?: string;
}

export interface GameManifestLike {
  world?: WorldManifestLike;
  contracts?: ContractManifestLike[];
}
