import { graphql } from "../gql";

export const GET_ETERNUM_STATISTICS = graphql(`
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
