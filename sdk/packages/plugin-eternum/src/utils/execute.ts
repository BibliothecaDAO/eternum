const stepOneTemplate = `{{goals}}

{{worldState}} -> general world state

{{query}} - all graphql queries possible. 

Based on the above decide what information you need to fetch from the game. Use the schema examples and format the query accordingly to match the schema.

Return the query and parameters as an object like this:

\`\`\`
{
  query: <query>,
  variables: {
    // variables go here
  }
}
\`\`\`
  
`;

const stepTwoTemplate = `{{goals}}

{{worldState}} -> general world state

{{query}} - all graphql queries possible. 

Based on the above decide what information you need to fetch from the game. Use the schema examples and format the query accordingly to match the schema.
`;

const stepThreeTemplate = `

`;

const defineSteps = `

You should return an array of steps to execute. Each step should have a name and a template.

Example:

\`\`\`
[
  { name: "step one", template: stepOneTemplate },
  { name: "step two", template: stepTwoTemplate },
  { name: "step three", template: stepThreeTemplate },
]
\`\`\`
`;

export { defineSteps, stepOneTemplate, stepThreeTemplate, stepTwoTemplate };
