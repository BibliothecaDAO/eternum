# Game App

This is the main game application for Eternum, built with React, TypeScript, and Vite.

## Running Locally

To run the game locally:

1. Make a copy of `.env.local.sample` and rename it to `.env.local`
2. Update the following environment variables in `.env.local` based on your target environment:
   - `VITE_PUBLIC_TORII="http://127.0.0.1:8080"`
   - `VITE_PUBLIC_NODE_URL="http://127.0.0.1:5050"`
3. Run `pnpm run dev` to start the development server
