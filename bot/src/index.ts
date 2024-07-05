import { Hono } from "hono";

const app = new Hono();

// In-memory storage for users
const users: { [id: string]: { discordName: string; walletAddress: string } } = {};
let nextId = 1;

// Create a new user
app.post("/users", async (c) => {
  const { discordName, walletAddress } = await c.req.json();
  const id = String(nextId++);
  users[id] = { discordName, walletAddress };
  return c.json({ id, discordName, walletAddress }, 201);
});

// Read all users
app.get("/users", (c) => {
  return c.json(Object.entries(users).map(([id, user]) => ({ id, ...user })));
});

// Read a specific user
app.get("/users/:id", (c) => {
  const id = c.req.param("id");
  const user = users[id];
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json({ id, ...user });
});

// Update a user
app.put("/users/:id", async (c) => {
  const id = c.req.param("id");
  if (!users[id]) return c.json({ error: "User not found" }, 404);
  const { discordName, walletAddress } = await c.req.json();
  users[id] = { discordName, walletAddress };
  return c.json({ id, ...users[id] });
});

// Delete a user
app.delete("/users/:id", (c) => {
  const id = c.req.param("id");
  if (!users[id]) return c.json({ error: "User not found" }, 404);
  delete users[id];
  return c.text("User deleted successfully");
});

// Keep the original route
app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default app;
