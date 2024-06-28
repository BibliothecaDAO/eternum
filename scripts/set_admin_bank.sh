#!/bin/bash

cd contracts

echo "----- Creating Admin Bank -----"
bun --env-file=../client/.env.local ../config/bank/index.ts

