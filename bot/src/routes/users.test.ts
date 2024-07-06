import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import app from "./users";

vi.mock("drizzle-orm/neon-http");
vi.mock("@neondatabase/serverless");

describe("User Routes", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };
    vi.mocked(drizzle).mockReturnValue(mockDb);
    vi.mocked(neon).mockReturnValue({} as any);
  });

  describe("POST /users/create", () => {
    it("should create a new user", async () => {
      mockDb.returning.mockResolvedValue([{ created_at: "2023-01-01T00:00:00Z" }]);
      const res = await app.request("/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: "0x123", discord: "user#1234", telegram: "@user" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.created_at).toBe("2023-01-01T00:00:00Z");
    });

    it("should return 409 if user already exists", async () => {
      mockDb.limit.mockResolvedValue([{ address: "0x123" }]);
      const res = await app.request("/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: "0x123", discord: "user#1234", telegram: "@user" }),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe("User already exists");
    });
  });

  describe("GET /users/:address", () => {
    it("should return user data", async () => {
      mockDb.limit.mockResolvedValue([{ address: "0x123", discord: "user#1234" }]);
      const res = await app.request("/users/0x123");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.address).toBe("0x123");
    });

    it("should return 404 if user not found", async () => {
      mockDb.limit.mockResolvedValue([]);
      const res = await app.request("/users/0x456");
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe("User not found");
    });
  });
  describe("PUT /users/:address", () => {
    it("should update user data", async () => {
      mockDb.returning.mockResolvedValue([{ address: "0x123", discord: "newuser#5678" }]);
      const res = await app.request("/users/0x123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord: "newuser#5678" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.discord).toBe("newuser#5678");
    });

    it("should return 404 if user not found", async () => {
      mockDb.returning.mockResolvedValue([]);
      const res = await app.request("/users/0x456", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord: "newuser#5678" }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe("User not found");
    });
  });

  describe("DELETE /users/:address", () => {
    it("should delete user", async () => {
      mockDb.returning.mockResolvedValue([{ address: "0x123" }]);
      const res = await app.request("/users/0x123", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe("User deleted successfully");
    });

    it("should return 404 if user not found", async () => {
      mockDb.returning.mockResolvedValue([]);
      const res = await app.request("/users/0x456", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe("User not found");
    });
  });
});
