import { z } from "zod";

// Common schemas
const stringField = z.string();
const numberField = z.number();

export const UserQuerySchema = z.object({
  address: stringField,
});

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}
