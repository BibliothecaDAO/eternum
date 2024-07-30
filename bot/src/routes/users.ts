import { Hono } from "hono";
import { drizzle } from "drizzle-orm/neon-http";
import { zValidator } from "@hono/zod-validator";
import { neon } from "@neondatabase/serverless";
import { UserQuerySchema } from "../types";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { solidityPackedKeccak256 } from "ethers";
import { ApiResponse } from "../types";

const app = new Hono();

app.post("/users/create", zValidator("json", UserQuerySchema), async (c) => {
  const data = c.req.valid("json");

  if (!data.address) {
    return c.json<ApiResponse<null>>({ success: false, message: "Address is required" }, 400);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  // Check if the user already exists
  const existingUser = await db.select().from(users).where(eq(users.address, data.address)).limit(1);

  if (existingUser.length > 0) {
    return c.json<ApiResponse<null>>({ success: false, message: "User already exists" }, 409);
  }

  // Insert new user if not exists
  const result = await db.insert(users).values({ address: data.address }).returning({ created_at: users.createdAt });

  return c.json<ApiResponse<(typeof result)[0]>>({
    success: true,
    data: result[0],
  });
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default app;
