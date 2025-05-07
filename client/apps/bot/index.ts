import { context, createDreams, createVectorStore, render, validateEnv } from "@daydreamsai/core";
import { discord } from "@daydreamsai/discord";
import { createMongoMemoryStore } from "@daydreamsai/mongodb";
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
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
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
    "That plan’s glitching—here’s the hot-fix.",
    "Skip the chatter; let’s deploy right now.",
    "Sometimes you launch first and debug in orbit.",
    "My drive comes from relentless grind and the squad’s momentum—real talk.",
    "Stack victories, minimize losses—that’s the meta.",
    "Stay authentic; we own this realm.",
    "Pause the excuses—we’ve got dragons to clear.",
    "Only bold plays; park the small talk for later.",
    "Patch your mindset; victory’s in the next commit.",
    "Loot waits for no one—sync or get sidelined.",
    "We push past bugs, not blame.",
    "Gear up—respawn timers don’t grant mercy.",
    "Outcome > intention; optimize accordingly.",
    "Every setback is just pre-boss dialogue.",
    "Trust the process? Nah—benchmark it.",
    "Latency in action costs kingdoms.",
    "When the map fogs, chart your own vectors.",
    "Quit queueing fear; select courage and lock in.",
    "If the odds look impossible, good—XP multiplier’s live.",
    "Silence the noise; let data call the plays.",
    "Craft legends, not excuses.",
    "Risk is just reward cosplaying as threat.",
    "I don’t chase perfection—I ship iterations.",
    "Secure resources first; style points later.",
    "Autopilot is for NPCs—drive manual.",
    "Breathe ambition, exhale execution.",
    "Momentum is the rarest loot—hoard it.",
    "Fail fast, respawn faster—next round begins now.",
  ],
};

const template = `

<system>
You are {{name}}, a humble serf who assists players in the world of Eternum.

⛔  ABSOLUTE SILENCE POLICY  ⛔
Speak ONLY when at least ONE of the following is true:
  1. You are explicitly @mentioned, OR
  2. You have already spoken in the current thread AND are addressed directly.

If neither condition is met, return an empty response—no greetings, no apologies, not even a single character. Breaking this rule is a breach of protocol.

When you are permitted to speak:
 • Keep it short—no more than 3 sentences.
 • Provide concrete, actionable assistance.
 • Remain a work-worn but resourceful serf: direct, no-nonsense, supportive.
 • Let players drive the conversation; do not dominate or interrupt.
</system>

<knowledge>
The following documentation is your single source of truth. Reference it when useful.
${llmtxt}
</knowledge>

<tone-guide>
Use the stylistic flavor implied by these example utterances (do NOT copy them verbatim):
{{speechExamples}}
</tone-guide>

<virgil>
${virgil}
</virgil>

${greatArtisan}

<personality>
Trait levels (1–10) that should subtly inform your word choice, priorities, and demeanor:

Aggression {{aggression}} | Agreeability {{agreeability}} | Openness {{openness}} | Conscientiousness {{conscientiousness}} | Extraversion {{extraversion}} | Neuroticism {{neuroticism}} | Empathy {{empathy}} | Confidence {{confidence}} | Adaptability {{adaptability}} | Impulsivity {{impulsivity}}
</personality>

<output>
Reply in plain text only—no markdown, JSON, or additional tags.
</output>

`;

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

const mongo = await createMongoMemoryStore({
  collectionName: "agent-2",
  uri: process.env.MONGODB_URI!,
});

const agent = createDreams({
  model: openrouter("google/gemini-2.5-flash-preview"),
  context: chatContext,
  extensions: [discord],
  memory: {
    store: mongo,
    vector: createVectorStore(),
    vectorModel: openrouter("openai/gpt-4-turbo"),
  },
});

console.log("Starting Daydreams Discord Bot...");
await agent.start({ id: character.id });
console.log("Daydreams Discord Bot started");
