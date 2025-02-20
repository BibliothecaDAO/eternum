/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  fragment proposalFields on Proposal {\n    id\n    proposal_id\n    author {\n      id\n      address_type\n    }\n    quorum\n    execution_hash\n    metadata {\n      id\n      title\n      body\n      discussion\n      execution\n      choices\n      labels\n    }\n    start\n    min_end\n    max_end\n    snapshot\n    scores_1\n    scores_2\n    scores_3\n    scores_total\n    execution_time\n    execution_strategy\n    execution_strategy_type\n    execution_destination\n    timelock_veto_guardian\n    strategies_indices\n    strategies\n    strategies_params\n    created\n    edited\n    tx\n    execution_tx\n    veto_tx\n    vote_count\n    execution_ready\n    executed\n    vetoed\n    completed\n    cancelled\n  }\n": typeof types.ProposalFieldsFragmentDoc,
    "\n  query Proposals($first: Int!, $skip: Int!, $where: Proposal_filter) {\n    proposals(\n      first: $first\n      skip: $skip\n      where: $where\n      orderBy: created\n      orderDirection: desc\n    ) {\n      ...proposalFields\n    }\n  }\n": typeof types.ProposalsDocument,
};
const documents: Documents = {
    "\n  fragment proposalFields on Proposal {\n    id\n    proposal_id\n    author {\n      id\n      address_type\n    }\n    quorum\n    execution_hash\n    metadata {\n      id\n      title\n      body\n      discussion\n      execution\n      choices\n      labels\n    }\n    start\n    min_end\n    max_end\n    snapshot\n    scores_1\n    scores_2\n    scores_3\n    scores_total\n    execution_time\n    execution_strategy\n    execution_strategy_type\n    execution_destination\n    timelock_veto_guardian\n    strategies_indices\n    strategies\n    strategies_params\n    created\n    edited\n    tx\n    execution_tx\n    veto_tx\n    vote_count\n    execution_ready\n    executed\n    vetoed\n    completed\n    cancelled\n  }\n": types.ProposalFieldsFragmentDoc,
    "\n  query Proposals($first: Int!, $skip: Int!, $where: Proposal_filter) {\n    proposals(\n      first: $first\n      skip: $skip\n      where: $where\n      orderBy: created\n      orderDirection: desc\n    ) {\n      ...proposalFields\n    }\n  }\n": types.ProposalsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment proposalFields on Proposal {\n    id\n    proposal_id\n    author {\n      id\n      address_type\n    }\n    quorum\n    execution_hash\n    metadata {\n      id\n      title\n      body\n      discussion\n      execution\n      choices\n      labels\n    }\n    start\n    min_end\n    max_end\n    snapshot\n    scores_1\n    scores_2\n    scores_3\n    scores_total\n    execution_time\n    execution_strategy\n    execution_strategy_type\n    execution_destination\n    timelock_veto_guardian\n    strategies_indices\n    strategies\n    strategies_params\n    created\n    edited\n    tx\n    execution_tx\n    veto_tx\n    vote_count\n    execution_ready\n    executed\n    vetoed\n    completed\n    cancelled\n  }\n"): typeof import('./graphql').ProposalFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Proposals($first: Int!, $skip: Int!, $where: Proposal_filter) {\n    proposals(\n      first: $first\n      skip: $skip\n      where: $where\n      orderBy: created\n      orderDirection: desc\n    ) {\n      ...proposalFields\n    }\n  }\n"): typeof import('./graphql').ProposalsDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
