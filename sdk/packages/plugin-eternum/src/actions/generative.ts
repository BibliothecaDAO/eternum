// TODO: Implement this for Starknet.
// It should just transfer tokens from the agent's wallet to the recipient.

import {
  ActionExample,
  elizaLogger,
  generateObject,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelClass,
  type Action,
} from "@ai16z/eliza";
import { validateStarknetConfig } from "../enviroment";
import { EternumState } from "../types";
import { composeContext } from "../utils";
import { defineSteps } from "../utils/execute";

export default {
  name: "CALL",
  similes: ["GAME_ACTION"],
  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    await validateStarknetConfig(runtime);
    return true;
  },
  description:
    "MUST use this action if the user requests send a token or transfer a token, the request might be varied, but it will always be a token transfer. If the user requests a transfer of lords, use this action.",
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: EternumState,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<boolean> => {
    elizaLogger.log("Starting SEND_TOKEN handler...");

    // Initialize or update state
    if (!state) {
      state = (await runtime.composeState(message, {
        worldState: "", // this should use the Eternum Client to get the world state
        queriesAvailable: "", // this should use Eternum Client to get the queries available
        availableActions: "", // this should use the Available Actions to get the available actions
      })) as EternumState;
    } else {
      state = (await runtime.updateRecentMessageState(state)) as EternumState;
    }

    // Compose transfer context

    const templates = {
      defineSteps: defineSteps,
    };

    const handleStepError = (step: string) => {
      elizaLogger.error(`Error generating ${step} content`);
      if (callback) {
        callback({
          text: "Unable to process transfer request",
          content: {
            worldState: state.worldState,
            error: `Failed during ${step} step`,
          },
        });
      }
      return true;
    };

    const generateStep = async (
      template: string,
    ): Promise<
      | {
          actionType: "invoke" | "query";
          data: string;
        }
      | boolean
    > => {
      const context = composeContext({
        state,
        template,
      });

      elizaLogger.debug("context", context);

      const content = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.MEDIUM,
      });

      elizaLogger.debug("content", content);
      return content;
    };

    // First, get the steps from the model
    const stepsContent = await generateStep(templates.defineSteps);

    if (!stepsContent || typeof stepsContent !== "string") {
      return handleStepError("steps definition");
    }

    // Parse the steps returned by the model
    let modelDefinedSteps: Array<{
      name: string;
      template: string;
    }>;

    try {
      modelDefinedSteps = JSON.parse(stepsContent);
      if (!Array.isArray(modelDefinedSteps)) {
        throw new Error("Steps must be an array");
      }
    } catch (e) {
      elizaLogger.error("Failed to parse steps:", e);
      return handleStepError("steps parsing");
    }

    // Execute each step
    for (const step of modelDefinedSteps) {
      const content = await generateStep(step.template);

      const parsedContent = typeof content === "string" ? JSON.parse(content) : content;

      if (!parsedContent) {
        return handleStepError(step.name);
      }

      if (typeof content === "object" && "actionType" in content) {
        if (content.actionType === "invoke") {
          // TODO: implement actual invoke interface that takes calldata
          // pass in the content.data to the invoke function
        }

        if (content.actionType === "query") {
          // TODO: implement
          // pass in the content.data to the query function
        }
      }
    }

    // TODO: After this happens we need to evaluate how the action went
    // and if it was successful or not. If it was succesful we should store it in memory as an action to do xyz. This way
    // we know this action works for the task.

    const handleStepSuccess = () => {
      elizaLogger.success(`Action completed successfully:` + modelDefinedSteps);
      if (callback) {
        callback({
          text: "Action completed successfully",
          content: {
            worldState: state.worldState,
            steps: modelDefinedSteps,
          },
        });
      }
      return true;
    };

    return handleStepSuccess();
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Send 10 ETH to 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "I'll transfer 10 ETH to that address right away. Let me process that for you.",
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
