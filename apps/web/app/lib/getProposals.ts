/*import { networkId, opts } from "@/config";
import {
  clone,
  formatProposal,
  isProposalWithMetadata,
  joinHighlightProposal,
} from "@/utils/helpers";*/
import { graphql } from "@/gql";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { SnapshotSpaceAddresses } from "@realms-world/constants";

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
/*                  loadProposals Server Function                           */
/* -------------------------------------------------------------------------- */

// Define a Zod schema for the proposals request input.
const LoadProposalsInput = z.object({
  spaceIds: z.array(z.string()),
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

/**
 * This function wraps the loadProposals logic and uses generic fetch
 * to execute GraphQL POST calls instead of Apollo.
 */
export const getProposals = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoadProposalsInput.parse(input))
  .handler(async (ctx) => {
    const { spaceIds, limit, skip, /* current, filters,*/ searchQuery } =
      ctx.data;
    // Clone filters to avoid mutations.
    //const _filters: any = JSON.parse(JSON.stringify(filters || {}));
    const metadataFilters: Record<string, string> = {
      title_contains_nocase: searchQuery,
    };

    // Apply state-based filtering.
    /*const state = filters?.state;
    if (state === "active") {
      filters.start_lte = current;
      _filters.max_end_gte = current;
    } else if (state === "pending") {
      _filters.start_gt = current;
    } else if (state === "closed") {
      _filters.max_end_lt = current;
    }
    delete _filters.state;

    // Apply labels filtering if provided.
    if (_filters.labels?.length) {
      metadataFilters.labels_contains = _filters.labels;
    }
    delete _filters.labels;
*/
    // Define variables for the proposals query.
    const variables = {
      first: limit,
      skip,
      where: {
        space_in: spaceIds,
        cancelled: false,
        metadata_: metadataFilters,
        //..._filters,
      },
    };

    // Fetch proposals using the generic fetch helper.
    const proposalsData = await execute(PROPOSALS_QUERY, variables);
    //let proposals = proposalsData.proposals;

    /*  // Optionally, fetch highlight data if needed.
    if (proposals.length > 0) {
      const highlightVariables = { ids: proposals.map((p: any) => p.id) };
      const highlightData = await graphqlFetch<{ sxproposals: any[] }>(
        HIGHLIGHT_PROPOSALS_QUERY,
        highlightVariables,
        HIGHLIGHT_PROPOSALS_ENDPOINT,
      );

      proposals = proposals.map((proposal: any) => {
        const highlightProposal = highlightData.sxproposals.find(
          (hp: any) => hp.id === proposal.id,
        );
        return joinHighlightProposal(proposal, highlightProposal);
      });
    }*/

    // Filter and format the proposals before returning them.
    return proposalsData;
  });

/* -------------------------------------------------------------------------- */
/*                   React Query Options for loadProposals                  */
/* -------------------------------------------------------------------------- */

export const getProposalsQueryOptions = (
  input: z.infer<typeof LoadProposalsInput>,
) =>
  queryOptions({
    queryKey: [
      "loadProposals",
      input.spaceIds,
      input.limit,
      input.skip,
      input.current,
      input.filters,
      input.searchQuery,
    ],
    queryFn: () => getProposals({ data: input }),
  });

/* -------------------------------------------------------------------------- */
/*                   getProposal Server Function                             */
/* -------------------------------------------------------------------------- */

// Define a Zod schema for the proposal request input.
const LoadProposalInput = z.object({
  id: z.string(),
});

/**
 * This function fetches a single proposal by ID
 */
export const getProposal = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoadProposalInput.parse(input))
  .handler(async (ctx) => {
    const { id } = ctx.data;

    // Fetch a single proposal using the generic fetch helper
    const proposalData = await execute(PROPOSAL_QUERY, {
      id: `${SnapshotSpaceAddresses[SUPPORTED_L2_CHAIN_ID]}/${id}`,
    });

    // Return the proposal data
    return proposalData;
  });

/* -------------------------------------------------------------------------- */
/*                   React Query Options for getProposal                     */
/* -------------------------------------------------------------------------- */

export const getProposalQueryOptions = (
  input: z.infer<typeof LoadProposalInput>,
) =>
  queryOptions({
    queryKey: ["loadProposal", input.id],
    queryFn: () => getProposal({ data: input }),
  });
