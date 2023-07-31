# Eternum Game Client

This project is a client-side application written in React TypeScript and using
the Vite bundler.

## Installation

1. Install dependencies using yarn: `yarn install`

## Running the Dev Server

1. Run the dev server: `yarn dev`

## Running locally on Katana

0. Go to the `contracts` directory: `cd contracts`
1. Build contracts: `sozo build`
2. Run katana: `katana --allow-zero-max-fee`
3. Apply migrations: `sozo migrate --name eternum`
4. Run indexer: `torii --manifest target/dev/manifest.json`
5. Apply env variables: `source scripts/env_variables.sh`
6. Set config: `./scripts/set_config.sh`

## Running on Madara

TBD

## Building the Project

1. Generate code from GraphQL: `yarn codegen`
2. Build the project: `yarn build`
3. Preview the project: `yarn preview`
