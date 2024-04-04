#!/bin/bash

echo "Migrating World and Indexing"
cd contracts
sozo migrate --name eternum


echo "Auth and World Contracts: Set 0.1s"
source scripts/env_variables.sh dev
./scripts/set_config.sh --interval 0.1 --mode dev


echo "Started indexer"
torii --world 0x177a3f3d912cf4b55f0f74eccf3b7def7c6144efeba033e9f21d9cdb0230c64