# Bot

An AI-powered Discord bot for Eternum that provides game assistance and roleplay interactions.

## Getting Started

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Architecture

The bot is designed as a conversational AI assistant with multiple personality modes and game knowledge integration:

```
bot/
├── index.ts                 # Main bot application and Discord integration
├── llm.txt                  # Comprehensive game documentation for AI context
├── great-artisan.txt        # Great Artisan personality definition
└── virgil.txt               # Virgil personality definition
```

### Key Components

- **Discord Integration**: Built using Discord.js to handle server interactions, commands, and messaging
- **AI/LLM Integration**: Connects to language models with game-specific context from llm.txt
- **Personality System**: Multiple character personalities that can be switched between:
  - **Great Artisan**: A knowledgeable craftsman personality
  - **Virgil**: A wise guide personality (similar to Dante's guide)
- **Game Knowledge Base**: The llm.txt file contains comprehensive game mechanics, rules, and lore that the AI uses to
  provide accurate responses

### Features

- **Game Assistance**: Answers questions about game mechanics, strategies, and features
- **Roleplay Interactions**: Engages with players in character based on selected personality
- **Context-Aware Responses**: Uses the game documentation to provide accurate and helpful information
- **Multi-Server Support**: Can operate across multiple Discord servers simultaneously

### Configuration

The bot requires Discord bot tokens and AI service credentials to be configured in environment variables (not included
in the repository).

This project was created using `bun init` in bun v1.2.4. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
