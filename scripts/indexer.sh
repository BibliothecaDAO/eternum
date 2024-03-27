#!/bin/bash

echo "Migrating World and Indexing"
cd contracts
sozo migrate --name eternum4


echo "Auth and World Contracts: Set 0.1s"
source scripts/env_variables.sh dev
./scripts/set_config.sh --interval 0.1 --mode dev


echo "Started indexer"
torii --world 0xa92287241cfe50996a7d5b1af3ab036b99528e97a77980ac36c34dfda28562