/**
 * Minimal shared manifest shape used by provider/client packages.
 * Additional keys are preserved to support dojo manifest evolution.
 */
export interface ManifestContract {
  tag: string;
  address: string;
  [key: string]: unknown;
}

export interface ManifestWorldMetadata {
  rpc_url?: string;
  [key: string]: unknown;
}

export interface ManifestWorld {
  address: string;
  metadata?: ManifestWorldMetadata;
  [key: string]: unknown;
}

export interface Manifest {
  world: ManifestWorld;
  contracts: ManifestContract[];
  [key: string]: unknown;
}
