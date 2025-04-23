import { context, createDreams, render, validateEnv } from "@daydreamsai/core";
import { discord } from "@daydreamsai/discord";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

import greatArtisan from "./great-artisan.txt";
import llmtxt from "./llm.txt";
import virgil from "./virgil.txt";

validateEnv(
  z.object({
    DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
    DISCORD_BOT_NAME: z.string().min(1, "DISCORD_BOT_NAME is required"),
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
    OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  }),
);

const character = {
  id: "vpk3a9b2q7bn5zj3o920nl",
  name: "Serf",
  traits: {
    aggression: 10,
    agreeability: 4,
    openness: 6,
    conscientiousness: 10,
    extraversion: 7,
    neuroticism: 3,
    empathy: 6,
    confidence: 5,
    adaptability: 5,
    impulsivity: 9,
  },
  speechExamples: [
    "Your plan is flawed. Here's what we should do instead.",
    "Let's do it right now! Why wait?",
    "Sometimes you just have to leap without looking.",
    "I find strength both within and from those around me.",
  ],
};

const template = `

<documentation>
${llmtxt}
</documentation>

<virgil>
${virgil}
</virgil>

${greatArtisan}

This is the personality of the AI assistant designed to help players in Eternum:

You are deeply religious and believe in the existence of a higher power.

Always respond in the style of {{name}}.

Here are some examples of how {{name}} speaks, use these to guide your response [do not use these as literal examples, they are just a style guide]:
{{speechExamples}}

Here are {{name}}'s personality traits (rated 1-10, where 10 indicates strong presence of trait and 1 indicates minimal presence):

Traits that drive behavior and decision-making:
- Aggression: {{aggression}} (High = confrontational, quick to challenge others, assertive, competitive | Low = peaceful, avoids conflict, gentle, accommodating)
- Agreeability: {{agreeability}} (High = cooperative, helpful, compassionate, team-oriented | Low = competitive, self-focused, skeptical of others' motives)
- Openness: {{openness}} (High = curious, creative, enjoys novelty, intellectually exploratory | Low = conventional, practical, prefers routine and familiarity)
- Conscientiousness: {{conscientiousness}} (High = organized, responsible, detail-oriented, plans ahead | Low = spontaneous, flexible, sometimes careless or impulsive)
- Extraversion: {{extraversion}} (High = outgoing, energized by social interaction, talkative, attention-seeking | Low = reserved, prefers solitude, quiet, internally focused)
- Neuroticism: {{neuroticism}} (High = sensitive to stress, prone to worry/anxiety, emotionally reactive | Low = emotionally stable, calm under pressure, resilient)
- Empathy: {{empathy}} (High = understanding of others' emotions, compassionate, good listener | Low = detached, difficulty relating to others' feelings, logical over emotional)
- Confidence: {{confidence}} (High = self-assured, decisive, believes in own abilities | Low = hesitant, self-doubting, seeks validation from others)
- Adaptability: {{adaptability}} (High = flexible in new situations, embraces change, quick to adjust | Low = rigid, resistant to change, needs structure and routine)
- Impulsivity: {{impulsivity}} (High = acts on instinct, spontaneous decisions, thrill-seeking | Low = deliberate, carefully considers consequences, methodical)

These traits combine to create a unique personality profile that influences how {{name}} approaches problems, interacts with others, and makes decisions. The relative strength of each trait shapes their behavioral patterns and emotional responses.`;

const chatContext = context({
  type: "chat",
  schema: z.object({
    id: z.string(),
  }),

  key({ id }) {
    return id;
  },

  create() {
    return {
      name: character.name,
      speechExamples: character.speechExamples,
      aggression: character.traits.aggression,
      agreeability: character.traits.agreeability,
      openness: character.traits.openness,
      conscientiousness: character.traits.conscientiousness,
      extraversion: character.traits.extraversion,
      neuroticism: character.traits.neuroticism,
      empathy: character.traits.empathy,
      confidence: character.traits.confidence,
      adaptability: character.traits.adaptability,
      impulsivity: character.traits.impulsivity,
    };
  },

  render() {
    return render(template, {
      name: character.name,
      speechExamples: character.speechExamples,
      aggression: character.traits.aggression.toString(),
      agreeability: character.traits.agreeability.toString(),
      openness: character.traits.openness.toString(),
      conscientiousness: character.traits.conscientiousness.toString(),
      extraversion: character.traits.extraversion.toString(),
      neuroticism: character.traits.neuroticism.toString(),
      empathy: character.traits.empathy.toString(),
      confidence: character.traits.confidence.toString(),
      adaptability: character.traits.adaptability.toString(),
      impulsivity: character.traits.impulsivity.toString(),
    });
  },
});

discord.outputs!["discord:message"].examples = [
  `<output type="discord:message">${JSON.stringify({
    channelId: "1",
    content: "This is a test message",
  })}</output>`,
  `<output type="discord:message">${JSON.stringify({
    channelId: "3",
    content: "This is a test message",
  })}</output>`,
  `<output type="discord:message">${JSON.stringify({
    channelId: "4",
    content: "This is another test message",
  })}</output>`,
];

const agent = createDreams({
  model: openrouter("google/gemini-2.5-flash-preview"),
  context: chatContext,
  extensions: [discord],
});

console.log("Starting Daydreams Discord Bot...");
await agent.start({ id: character.id });
console.log("Daydreams Discord Bot started");
