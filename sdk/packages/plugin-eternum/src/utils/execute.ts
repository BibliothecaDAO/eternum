const queryTemplate = `{{goals}}

{{worldState}} -> general world state

{{query}} - all graphql queries possible. 

Based on the above decide what information you need to fetch from the game. Use the schema examples and format the query accordingly to match the schema.

Return the query and parameters as an object like this:

\`\`\`json
{
  "actionType": "query",
  "data": {
    "query": "<query>",
    "variables": {
      // variables go here
    }
  }
}
\`\`\`
  
`;

const invokeTemplate = `{{goals}}

{{worldState}}

{{availableActions}}

Based on the above decide what information you need to fetch from the game. Use the schema examples and format the query accordingly to match the schema.

Return the available calldata as an object like this:

\`\`\`json
{
  actionType: "query",
  data: {
    "tokenAddress": "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    "recipient": "0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
    "amount": "0.001"
  }
}
\`\`\`

`;

const stepThreeTemplate = `

`;

const defineSteps = `

Based on the goals and world state, decide what steps you need to execute to achieve the goals.

{{goals}}

{{worldState}}

You should return an array of steps to execute. Each step should have a name and a template.

Example:

Each of these templates are EXAMPLES. Create your own based on the context.

\`\`\`
[
  { name: "step one", reasoning: "Need to check for resources", template: ${queryTemplate} },
  { name: "step two", reasoning: "Need to check the base", template: ${invokeTemplate} },
  { name: "step three", reasoning: "Need to build calldata", template: ${stepThreeTemplate} },
]
\`\`\`

`;

export { defineSteps, stepThreeTemplate };
