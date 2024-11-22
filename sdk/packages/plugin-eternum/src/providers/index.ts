import { elizaLogger } from "@ai16z/eliza";

interface GraphQLResponse<T> {
    data?: T;
    errors?: Array<{
        message: string;
        locations?: Array<{
            line: number;
            column: number;
        }>;
        path?: string[];
    }>;
}

async function queryGraphQL<T>(
    endpoint: string,
    query: string,
    variables?: Record<string, unknown>
): Promise<T> {
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                variables,
            }),
        });

        const result = (await response.json()) as GraphQLResponse<T>;

        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        if (!result.data) {
            throw new Error("No data returned from GraphQL query");
        }

        return result.data;
    } catch (error) {
        elizaLogger.error("GraphQL query failed:", error);
        throw error;
    }
}

// 1.  fetch graphgl schema from game cache.

const message = `
{{goals}}

{{world state}}

{{query}}

Based on the above decide what information you need to fetch from the game. Use the schema examples and format the query accordingly to match the schema.

Return the query and parameters as an object like this:

{
  query: \`\`\`graphql
<query>
\`\`\`,
  variables: {
    // variables go here
  }
}
`;

const fetchData = async (query: string, variables: Record<string, unknown>) => {
    await queryGraphQL<string>("https://api.eternum.io/graphql", query, {
        variables,
    });
};

const messages = `
{{goals}}

{{world state}}

{{fetchedQuery}}

{{availableActions}}

Based on the above, decide what action to take. If no action to take return false

Only return the calldata of the action to take. Like this

\`\`\`
    {
        contractAddress: contractName,
        entrypoint: "create_order",
        calldata: [
            maker_id,
            maker_gives_resources.length / 2,
            ...maker_gives_resources,
            taker_id,
            taker_gives_resources.length / 2,
            ...taker_gives_resources,
            expires_at,
        ],
    }
\`\`\`
`;
