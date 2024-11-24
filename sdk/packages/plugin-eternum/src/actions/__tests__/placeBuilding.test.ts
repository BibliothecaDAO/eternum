import { createAnthropic } from "@ai-sdk/anthropic";
import { composeContext, elizaLogger, ModelClass, ModelProviderName, models } from "@ai16z/eliza";
import { generateText as aiGenerateText } from "ai";
import { evaluate } from "langsmith/evaluation";
import { describe, it } from "vitest";
import { placeBuildingTemplate } from "../placeBuilding";
import { relevanceEvaluator } from "./utils/evaluator";
import { testState } from "./utils/testState";

const apiKey = process.env.ANTHROPIC_API_KEY;
console.log({ apiKey });
const model = models[ModelProviderName.ANTHROPIC].model[ModelClass.MEDIUM];
const temperature = 0.5;
const max_response_length = 100;
const frequency_penalty = 0;
const presence_penalty = 0;
const system = undefined;

describe("PLACE_BUILDING_TEST", async () => {
  // creates a test that will check if the model response contaoins certain keywords
  it("it should check that model reponse is concise", async () => {
    const placeBuildingContext = composeContext({
      state: testState,
      template: placeBuildingTemplate,
    });

    elizaLogger.debug("Initializing Anthropic model.");

    const anthropic = createAnthropic({ apiKey });

    const { text: response } = await aiGenerateText({
      model: anthropic.languageModel(model),
      prompt: placeBuildingContext,
      system,
      temperature,
      maxTokens: max_response_length,
      frequencyPenalty: frequency_penalty,
      presencePenalty: presence_penalty,
    });

    await evaluate(
      (input) => {
        return {
          answer: input.question + " Good question. I don't know the answer",
        };
      },
      {
        data: response,
        evaluators: [relevanceEvaluator],
        experimentPrefix: "my first experiment ",
      },
    );
  });
});
