import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";
import { OpenAI } from "openai";

// Auto-trace LLM calls in-context
const client = wrapOpenAI(new OpenAI());
// Auto-trace this function
const pipeline = traceable(async (user_input) => {
  const result = await client.chat.completions.create({
    messages: [{ role: "user", content: user_input }],
    model: "gpt-4o-mini",
  });
  return result.choices[0].message.content;
});

await pipeline({ input: "Hello, world!" });
