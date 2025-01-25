import { graphql } from "../gql";

export const GET_ETERNUM_STATTISTICS = graphql(`
  query eternumStatistics {
    s1EternumAddressNameModels {
      totalCount
    }
    s1EternumHyperstructureModels {
      totalCount
    }
    s1EternumRealmModels {
      totalCount
    }
    s1EternumFragmentMineDiscoveredModels {
      totalCount
    }
  }
`);
