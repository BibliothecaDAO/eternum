# Eternum Game Client

This client-side application is developed using React TypeScript and employs the Vite bundler.

# Table of Contents

1. [Introduction](#introduction)
2. [Pre-requisites](#pre-requisites)
3. [Installation](#installation)
4. [Running the Development Server](#running-the-development-server)
5. [Setting Up and Running Locally on Katana](#setting-up-and-running-locally-on-katana)
6. [Building the Project](#building-the-project)
7. [Deployment](#deploying-with-vercel)

### Pre-requisites

Before beginning, ensure that you have set up your local environment according to the instructions provided in
[sdk/README.md](../sdk/readme.md). This client utilizes both the Bun package manager and the SDK packages.

For this to work correctly you will need to have katana running with the deployed contracts - this is easy!

### Installation

Run this at the root of this repo (not in this folder)

- **Dependencies:** Install all required dependencies by running the command:
  ```bash
  bun install
  ```

### Running the Development Server

- **Development Server:** Start the development server with:
  ```bash
  bun dev
  ```

### Setting Up and Running Locally on Katana

For local setup and execution on Katana, follow these steps:

1. **Navigate to Contracts Directory:**
   ```bash
   cd contracts
   ```
2. **Build Contracts:**
   ```bash
   sozo build
   ```
3. **Run Katana:**
   ```bash
   katana --disable-fee
   ```
4. **Apply Migrations:**
   ```bash
   sozo migrate
   ```
5. **Run Indexer:**
   ```bash
   torii --world <WORLD ADDRESS>
   ```
6. **Set Environment Variables:**
   ```bash
   source scripts/env_variables.sh
   ```
7. **Configure Settings:**
   ```bash
   ./scripts/set_config.sh
   ```

### Building the Project

To build and preview the project, follow these steps:

1. **Generate GraphQL Code:**
   ```bash
   bun run codegen
   ```
2. **Build the Project:**
   ```bash
   bun run build
   ```
3. **Preview the Project:**
   ```bash
   bun run preview
   ```

Certainly! Here's the Deployment section integrated into the document with a revised structure and clarity:

---

## Deployment

### Overview

Eternum is designed as a versatile Vite application, enabling deployment on a wide range of platforms. We highly
encourage diversity in client deployment, inviting you to take an active role in hosting a client (it can be free!).

### Recommended Deployment: Vercel

One of the easiest and most efficient ways to deploy your Eternum client is through Vercel. Vercel offers a seamless
deployment experience with just a few clicks.

#### Deploying with Vercel

To deploy on Vercel, simply use the following link. This will guide you through the process, allowing you to set up a
client quickly:

- **Deploy on Vercel:**
  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/BibliothecaDAO/eternum)

By following this link, you will be redirected to Vercel's platform where you can clone the Eternum repository and
initiate your deployment process.
