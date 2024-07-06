import { z } from "zod";

// Common schemas
const stringField = z.string();
const numberField = z.number();

export const UserQuerySchema = z.object({
  address: stringField,
  discord: stringField,
  telegram: stringField,
});

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export const UserUpdateSchema = z.object({
  discord: stringField.optional(),
  telegram: stringField.optional(),
  address: stringField.optional(),
});
