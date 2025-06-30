# Eternum Marketplace

A standalone marketplace application for trading Eternum NFTs including Realms, Season Passes, and Loot Chests.

## Features

- **Collection Browsing**: View all available NFT collections
- **Token Trading**: Buy and sell individual tokens
- **Bulk Operations**: Sweep multiple tokens at once
- **Trait Filtering**: Filter tokens by their attributes
- **Activity Tracking**: View recent marketplace activity
- **Wallet Integration**: Connect with Starknet wallets

## Collections

- **Realms**: Land parcels in the Eternum world
- **Season 1 Pass**: Access to seasonal content and rewards
- **Loot Chest**: Mystery boxes with various rewards

## Development

```bash
# Install dependencies
pnpm install

# Start development server for Sepolia testnet
pnpm dev --mode sepolia

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Environment Variables

The app uses the same environment variables as the main landing app. Make sure to set up your `.env` file with the necessary configuration.

## Architecture

This marketplace app is extracted from the main landing application and focuses solely on marketplace functionality. It includes:

- React Router for navigation
- TanStack Query for data fetching
- Starknet wallet integration
- Tailwind CSS for styling
- Radix UI components

## Port

The marketplace app runs on port 5175 by default (different from the landing app's 5174). 