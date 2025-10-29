import type { ZodError } from "zod";

export function formatZodError(error: ZodError): {
  errors: { path: string; message: string }[];
} {
  return {
    errors: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
