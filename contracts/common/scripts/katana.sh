#!/bin/bash

echo "Setting up Local Katana..."

# Run katana with the disable-fee option
katana --invoke-max-steps 25000000 --http.cors_origins "*" --block-time 2500  --dev --dev.no-fee
