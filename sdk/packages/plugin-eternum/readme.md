# Eternum Plugin

## Overview

The idea here is that we provide the agent with context about the game:

1. Decide Task
2. Decide Action
3. Execute Action

### Runtime

_Query 1:_

1. Look at goal, state of realm. So resource balances, buildings etc
2. Decide what information is needed for the context. Create a graphql query for it, and fetch the information. Keep in
   context.
3. Decide if you want to take an action or not.
   - If not, return and ask question again in 1 minute
   - If yes, continue to Query 2

_Query 2:_

1. Pass context from Query 1 into another lookup to find how to take that action.
2. consume the cache of available actions

_Execute 3:_

1. Take an action or not.

if success -> save memory

Repeat

### TODO:

1. Create file will all available actions formatted calldata.

- Add TypeDoc
