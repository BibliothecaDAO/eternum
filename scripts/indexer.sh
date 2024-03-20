#!/bin/bash

echo "Migrating World and Indexing"
cd contracts
sozo migrate


echo "Auth and World Contracts: Set 0.1s"
source scripts/env_variables.sh
./scripts/set_config.sh


echo "Started indexer"
torii --world 0x18fd848cbc9e4bb4742dfcfaf03c820421e70ee25916dbd6ca9cfc88f0336e2