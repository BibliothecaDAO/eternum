import { z } from "zod";

const envSchema = z.object({
  // Version and chain info
  DATABASE_URL: z.string(), // Add other chains as needed

});

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:", JSON.stringify(error.errors, null, 2));
  }
  throw new Error("Invalid environment variables");
}

export { env };

// Type for your validated env
export type Env = z.infer<typeof envSchema>;