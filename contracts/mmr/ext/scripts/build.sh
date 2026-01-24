#!/bin/bash

# Navigate to root contract directory (../../)
cd ../../

# Build contracts with Scarb
scarb --release build
