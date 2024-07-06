import { Hono } from "hono";
import { drizzle } from "drizzle-orm/neon-http";
import { zValidator } from "@hono/zod-validator";
import { neon } from "@neondatabase/serverless";
import { UserQuerySchema, UserUpdateSchema } from "../types";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

import { ApiResponse } from "../types";

const app = new Hono()
  .post("/users/create", zValidator("json", UserQuerySchema), async (c) => {
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
    const result = await db
      .insert(users)
      .values({ address: data.address, discord: data.discord, telegram: data.telegram })
      .returning({ created_at: users.createdAt });

    return c.json<ApiResponse<(typeof result)[0]>>({
      success: true,
      data: result[0],
    });
  })
  .get("/users/:address", async (c) => {
    const address = c.req.param("address");
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    const user = await db.select().from(users).where(eq(users.address, address)).limit(1);

    if (user.length === 0) {
      return c.json<ApiResponse<null>>({ success: false, message: "User not found" }, 404);
    }

    return c.json<ApiResponse<(typeof user)[0]>>({
      success: true,
      data: user[0],
    });
  })
  .put("/users/:address", zValidator("json", UserUpdateSchema), async (c) => {
    const address = c.req.param("address");
    const data = c.req.valid("json");
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    const result = await db.update(users).set(data).where(eq(users.address, address)).returning();

    if (result.length === 0) {
      return c.json<ApiResponse<null>>({ success: false, message: "User not found" }, 404);
    }

    return c.json<ApiResponse<(typeof result)[0]>>({
      success: true,
      data: result[0],
    });
  })
  .delete("/users/:address", async (c) => {
    const address = c.req.param("address");
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    const result = await db.delete(users).where(eq(users.address, address)).returning();

    if (result.length === 0) {
      return c.json<ApiResponse<null>>({ success: false, message: "User not found" }, 404);
    }

    return c.json<ApiResponse<null>>({
      success: true,
      message: "User deleted successfully",
    });
  });

export default app;
