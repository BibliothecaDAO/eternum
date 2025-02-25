/*import { networkId, opts } from "@/config";
import {
  clone,
  formatProposal,
  isProposalWithMetadata,
  joinHighlightProposal,
} from "@/utils/helpers";*/
import { graphql } from "@/gql";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { execute } from "./queries/execute";

graphql(`
  fragment voteFields on Vote {
    id
    voter {
      id
    }
    space {
      id
    }
    metadata {
      reason
    }
    proposal
    choice
    vp
    created
    tx
  }
`);
const USER_VOTES_QUERY = graphql(`
  query UserVotes(
    $first: Int
    $skip: Int
    $spaceIds: [String]
    $voter: String
  ) {
    votes(
      first: $first
      skip: $skip
      orderBy: proposal
      orderDirection: desc
      where: { space_in: $spaceIds, voter: $voter }
    ) {
      ...voteFields
    }
  }
`);

/* -------------------------------------------------------------------------- */
/*                  loadUserVotes Server Function                           */
/* -------------------------------------------------------------------------- */

// Define a Zod schema for the UserVotes request input.
const LoadUserVotesInput = z.object({
  spaceIds: z.array(z.string()),
  voter: z.string(),
  limit: z.number().min(1),
  skip: z.number().min(0).default(0),
});

/**
 * This function wraps the loadUserVotes logic and uses generic fetch
 * to execute GraphQL POST calls instead of Apollo.
 */
export const getUserVotes = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoadUserVotesInput.parse(input))
  .handler(async (ctx) => {
    const { spaceIds, limit, skip, voter } = ctx.data;
    // Define variables for the UserVotes query.
    const variables = {
      first: limit,
      skip,
      space_in: spaceIds,
      voter: voter,
    };

    // Fetch UserVotes using the generic fetch helper.
    const UserVotesData = await execute(USER_VOTES_QUERY, variables);

    // Filter and format the UserVotes before returning them.
    return UserVotesData;
  });

/* -------------------------------------------------------------------------- */
/*                   React Query Options for loadUserVotes                  */
/* -------------------------------------------------------------------------- */

export const getUserVotesQueryOptions = (
  input: z.infer<typeof LoadUserVotesInput>,
) =>
  queryOptions({
    queryKey: [
      "loadUserVotess",
      input.spaceIds,
      input.voter,
      input.limit,
      input.skip,
    ],
    queryFn: () => (input.voter ? getUserVotes({ data: input }) : null),
    enabled: !!input.voter,
  });
