# Debug Report: Chat Not Reaching Agent + Stamina Error on Wrong Entity
Generated: 2026-03-25

## Symptom
1. Messages sent from the game UI Chat tab do not reach the agent or produce responses.
2. Agent gets "insufficient stamina, you need: 30, and have: 10" but the user's unit has more stamina. User re-authed for a second game (etrn-mango) and suspects session key conflict from two games.

## Investigation Steps

### Step 1: Traced the chat send flow (UI -> Gateway -> DB)

The UI calls `sendMyAgentMessage()` which POSTs to `POST /my/agents/:agentId/messages`.

**Finding:** The gateway's `POST /my/agents/:agentId/messages` handler (lines 475-500 in `agent-gateway/src/index.ts`) **only saves the message to the database**. It does NOT:
- Forward the message to the coordinator DO
- Create a wake event
- Enqueue the agent for execution
- Send the message through `AGENT_RUN_QUEUE`

Compare with the working `POST /agents/:agentId/prompt` endpoint (lines 594-660) which does all four:
1. Posts message to coordinator DO (`/messages`)
2. Creates a `user_prompt` event on the coordinator (`/events`)
3. Wakes the coordinator (`/wake`)
4. Enqueues a job on `AGENT_RUN_QUEUE`

### Step 2: Confirmed the chat-bridge is unrelated to player chat

`packages/agent-runtime/src/chat-bridge.ts` is a `publishAgentWorldChat` function used for the agent to publish messages TO the world (outbound), not for receiving player messages (inbound). It uses a WebSocket `RealtimeClient` to broadcast to a world zone.

### Step 3: Traced session resolution for multi-world scenario

The session resolver (`CartridgeStoredSessionResolver` at `agent-executor/src/sessions/cartridge-stored-session-resolver.ts:42-43`) loads sessions by `agentId`:

```typescript
async load(input: LoadAgentSessionInput<Record<string, unknown>>): Promise<CartridgeStoredResolvedSession> {
    const stored = await this.loader.load(input.agentId);
```

The actual loader is `ExecutorRunStore.load()` (`agent-executor/src/persistence/executor-run-store.ts:122-160`), which queries:
- `agents` table by `agents.id = agentId`
- `agentSessions` table by `agentSessions.agentId = agentId`, ordered by `createdAt DESC`, `LIMIT 1`

### Step 4: Verified agent-to-world binding is 1:1

Each agent record has a unique `id` and a `worldId`. The `agents` table has a unique index on `(kind, ownerType, ownerId, worldId, displayName)` (schema at `packages/agent-runtime/src/db/schema.ts:71-77`).

When a player launches an agent for a second game (different worldId), `POST /my/agents` at line 151 calls `getPlayerAgentByWorld(ownerId, payload.worldId)`. Since the worldId is different, it creates a **new agent record** with a new UUID. Each world gets its own agent with its own session.

### Step 5: Verified session isolation per agent

The `agentSessions` table links sessions to agents via `agentId`, not via `ownerId/playerId`. The `ExecutorRunStore.load()` (line 132-136) filters sessions by `agentSessions.agentId = agentId`. The `loadLatestSession()` method in the postgres repo (line 566-574) also fetches only for a specific `agentId`.

No cross-agent session query exists anywhere in the codebase. Sessions are properly scoped.

### Step 6: Investigated the stamina error scenario

The `completePlayerAgentSetup` (line 136-188 in postgres repo) explicitly matches by both `agentId` AND `authSessionId`, preventing cross-write between agents. Two agents for the same player in different worlds will have completely separate session keys.

The stamina error is therefore NOT caused by session key cross-contamination.

## Evidence Summary

### Finding 1: POST /my/agents/:agentId/messages is store-only (CRITICAL BUG)
- **Location:** `client/apps/agent-gateway/src/index.ts:475-500`
- **Observation:** Saves message to DB but never wakes the agent
- **Relevance:** This is why chat does not work -- messages are stored but the agent never processes them

### Finding 2: POST /agents/:agentId/prompt has the full wake logic
- **Location:** `client/apps/agent-gateway/src/index.ts:594-660`
- **Observation:** Posts to coordinator, creates event, wakes, enqueues job
- **Relevance:** Shows the correct implementation that is missing from the /my/ endpoint

### Finding 3: Sessions are properly scoped per-agent (per-world)
- **Location:** `agent-executor/src/persistence/executor-run-store.ts:122-160`
- **Observation:** Session loader queries by `agentId` only, not by player
- **Relevance:** Rules out session key cross-contamination between worlds

### Finding 4: Agent-world binding is enforced by unique index
- **Location:** `packages/agent-runtime/src/db/schema.ts:71-77`
- **Observation:** Unique index on `(kind, ownerType, ownerId, worldId, displayName)` prevents duplicates
- **Relevance:** Each world gets a distinct agent record; no sharing

### Finding 5: Agent launch for second world creates new agent
- **Location:** `client/apps/agent-gateway/src/index.ts:151-163`
- **Observation:** `getPlayerAgentByWorld(ownerId, payload.worldId)` returns null for a new world, triggering new agent creation
- **Relevance:** Confirms world isolation at the agent record level

## Root Cause Analysis

### Issue 1: Chat messages not reaching agent

**Root Cause:** The `POST /my/agents/:agentId/messages` endpoint (lines 475-500) is a "store only" handler. It saves the user's message to the persistence layer but does not forward the message to the coordinator, create a wake event, or enqueue a run job. The agent never receives or processes the message.

**Confidence:** HIGH

### Issue 2: Stamina error on wrong entity

**Root Cause:** Sessions are properly isolated per-agent (per-world). The stamina error is NOT caused by session key cross-contamination. More likely causes:
- The agent is operating on the correct world but selecting a different entity than the one the user expects
- The entity's stamina was depleted by a previous autonomous tick before the user checked
- The agent is reading stale world state from Torii

**Confidence:** HIGH that it is NOT a session issue. LOW confidence on identifying the exact stamina cause without game-level logs.

**Alternative hypotheses for stamina:**
- The agent's previous autonomous tick spent the stamina
- The agent controls a different army/entity than the user is viewing
- Stale Torii cache giving wrong stamina values

## Recommended Fix

### Fix 1: Chat messages not waking agent (CRITICAL)

**Files to modify:**
- `client/apps/agent-gateway/src/index.ts` (lines 475-500)

**Steps:**
1. After saving the message with `repository.appendPlayerAgentMessage()` (line 498), add the wake-and-enqueue logic from `POST /agents/:agentId/prompt`:
   - Get the coordinator stub: `getCoordinatorStub(c.env, detail.id)`
   - Post message to coordinator: `stub.fetch("https://agent.internal/messages", ...)`
   - Create and post a `user_prompt` event: `stub.fetch("https://agent.internal/events", ...)`
   - Wake the coordinator: `stub.fetch("https://agent.internal/wake", ...)`
   - Enqueue on `AGENT_RUN_QUEUE` if available

2. Consider extracting a shared `wakeAgentForUserPrompt(env, agentId, message)` helper to avoid duplicating the wake logic between `POST /my/agents/:agentId/messages` and `POST /agents/:agentId/prompt`.

### Fix 2: Stamina investigation (LOWER PRIORITY)

To rule out any data-level issue, query the database:
```sql
SELECT a.id, a.world_id, a.owner_id, s.id as session_id, s.status, s.session_account_address, s.created_at
FROM agents a
LEFT JOIN agent_sessions s ON s.agent_id = a.id
WHERE a.owner_id = '<player_address>'
ORDER BY a.created_at, s.created_at;
```
Verify each agent has exactly one approved session pointing to the correct world.

## Answers to Specific Questions

**Q1: When a player has agents in 2 different worlds, how does the session resolver pick which session to use?**
A: Each world has its own agent record with a unique agentId. The session resolver loads by agentId (not by player). So agent-for-world-1 loads session-for-world-1, and agent-for-world-2 loads session-for-world-2. No ambiguity.

**Q2: Is the session scoped to worldId or shared across all agents for a player?**
A: Scoped to agentId, which is 1:1 with worldId for a given player. Not shared.

**Q3: In the chat flow, how is the message routed to the correct agent instance?**
A: The UI sends to `POST /my/agents/:agentId/messages` with the specific agentId. The gateway looks up the agent by (ownerId, agentId) and stores the message for that agent's thread. **However, the message is never forwarded to the executor -- this is the bug.**

**Q4: Could a stale/wrong session cause the agent to operate on entities from the wrong world?**
A: No. Sessions are isolated per-agent. A stale session would cause an auth error, not a wrong-world error.

## Prevention

1. Extract the "store message + wake agent" logic into a shared function used by both `/my/` and `/agents/` message endpoints.
2. Add integration tests verifying that POST to `/my/agents/:agentId/messages` triggers agent execution.
3. Add a comment linking the two message endpoints so future developers keep them in sync.
