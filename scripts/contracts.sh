#!/bin/bash

# Navigate to the root of the repo to install dependencies
echo "Building Contracts"

echo "Setting up Katana..."
cd contracts
sozo build

katana --disable-fee