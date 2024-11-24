import { GradingFunctionParams, StringEvaluator } from "langsmith/evaluation";

// Define the grading function for relevance evaluation
const gradeRelevance: (params: GradingFunctionParams) => Promise<{ key: string; comment: string }> = async ({
  input,
  prediction,
  answer,
}) => {
  // Implement the logic to determine if the prediction directly addresses building placement
  // For example, you might compare the prediction to the answer, or check for certain keywords
  // This is a placeholder implementation
  const isRelevant = prediction.includes("building") && prediction.includes("placement");
  return {
    key: "answer_relevance",
    comment: isRelevant
      ? "The response is relevant to building placement."
      : "The response does not address building placement adequately.",
  };
};

// Add this evaluator alongside the existing isConcise evaluator
export const relevanceEvaluator = new StringEvaluator({
  evaluationName: "answer_relevance",
  inputKey: "input", // Assuming 'input' is the key for the input text in the Run object
  predictionKey: "prediction", // Assuming 'prediction' is the key for the model's prediction in the Run object
  gradingFunction: gradeRelevance,
});
