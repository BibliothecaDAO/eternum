import { graphql } from "../gql";

export const GET_ETERNUM_STATTISTICS = graphql(`
  query eternumStatistics {
    s0EternumAddressNameModels {
      totalCount
    }
    s0EternumHyperstructureModels {
      totalCount
    }
    s0EternumRealmModels {
      totalCount
    }
    s0EternumFragmentMineDiscoveredModels {
      totalCount
    }
  }
`);
