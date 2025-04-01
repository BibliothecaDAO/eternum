/*import { networkId, opts } from "@/config";
import {
  clone,
  formatProposal,
  isProposalWithMetadata,
  joinHighlightProposal,
} from "@/utils/helpers";*/
import { graphql } from "@/gql";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";


import { execute } from "./queries/execute";

graphql(`
  fragment proposalFields on Proposal {
    id
    proposal_id
    space {
      id
      controller
      authenticators
      metadata {
        id
        name
        avatar
        voting_power_symbol
        treasuries
        executors
        executors_types
        executors_strategies {
          id
          address
          destination_address
          type
          treasury_chain
          treasury
        }
      }
      strategies_parsed_metadata {
        index
        data {
          id
          name
          description
          decimals
          symbol
          token
          payload
        }
      }
    }
    author {
      id
      address_type
    }
    quorum
    execution_hash
    metadata {
      id
      title
      body
      discussion
      execution
      choices
      labels
    }
    start
    min_end
    max_end
    snapshot
    scores_1
    scores_2
    scores_3
    scores_total
    execution_time
    execution_strategy
    execution_strategy_type
    execution_destination
    timelock_veto_guardian
    strategies_indices
    strategies
    strategies_params
    created
    edited
    tx
    execution_tx
    veto_tx
    vote_count
    execution_ready
    executed
    vetoed
    completed
    cancelled
  }
`);
export const PROPOSAL_QUERY = graphql(`
  query Proposal($id: String!) {
    proposal(id: $id) {
      ...proposalFields
    }
  }
`);

const PROPOSALS_QUERY = graphql(`
  query Proposals($first: Int!, $skip: Int!, $where: Proposal_filter) {
    proposals(
      first: $first
      skip: $skip
      where: $where
      orderBy: created
      orderDirection: desc
    ) {
      ...proposalFields
    }
  }
`);

/* -------------------------------------------------------------------------- */
/*                  loadProposals Function                                    */
/* -------------------------------------------------------------------------- */

// Define a Zod schema for the proposals request input.
const LoadProposalsInput = z.object({
  limit: z.number().min(1),
  skip: z.number().min(0).default(0),
  current: z.number(),
  filters: z
    .object({
      state: z.enum(["any", "active", "pending", "closed"]).optional(),
      labels: z.string().array().optional(),
    })
    .optional(),
  searchQuery: z.string().default(""),
});

type LoadProposalsInputType = z.infer<typeof LoadProposalsInput>;

/**
 * This function wraps the loadProposals logic and uses generic fetch
 * to execute GraphQL POST calls instead of Apollo.
 */
export async function getProposals(input: LoadProposalsInputType) {
  const { limit, skip, /* current, filters,*/ searchQuery } = input;
  
  const metadataFilters: Record<string, string> = {
    title_contains_nocase: searchQuery,
  };

  // Define variables for the proposals query.
  const variables = {
    first: limit,
    skip,
    where: {
      space_in: ["0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62"      ],
      cancelled: false,
      metadata_: metadataFilters,
    },
  };

  // Fetch proposals using the generic fetch helper.
  const proposalsData = await execute(PROPOSALS_QUERY, variables);

  return proposalsData;
}

/* -------------------------------------------------------------------------- */
/*                   React Query Options for loadProposals                  */
/* -------------------------------------------------------------------------- */

export const getProposalsQueryOptions = (
  input: LoadProposalsInputType,
) =>
  queryOptions({
    queryKey: [
      "loadProposals",
      input.limit,
      input.skip,
      input.current,
      input.filters,
      input.searchQuery,
    ],
    queryFn: () => getProposals(input),
  });

/* -------------------------------------------------------------------------- */
/*                   getProposal Function                                    */
/* -------------------------------------------------------------------------- */

// Define a Zod schema for the proposal request input.
const LoadProposalInput = z.object({
  id: z.string(),
});

type LoadProposalInputType = z.infer<typeof LoadProposalInput>;

/**
 * This function fetches a single proposal by ID
 */
export async function getProposal(input: LoadProposalInputType) {
  const { id } = input;

  // Fetch a single proposal using the generic fetch helper
  const proposalData = await execute(PROPOSAL_QUERY, {
    id: `0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62/${id}`,
  });

  // Return the proposal data
  return proposalData;
}

/* -------------------------------------------------------------------------- */
/*                   React Query Options for getProposal                     */
/* -------------------------------------------------------------------------- */

export const getProposalQueryOptions = (
  input: LoadProposalInputType,
) =>
  queryOptions({
    queryKey: ["loadProposal", input.id],
    queryFn: () => getProposal(input),
  });
