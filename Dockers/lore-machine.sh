#!/bin/bash 

make install

poetry run lore-machine --mock --address 0.0.0.0 --world_db $WORLD_DB
