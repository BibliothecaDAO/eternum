import type { ZodError } from "zod";
export declare function formatZodError(error: ZodError): {
    errors: {
        path: string;
        message: string;
    }[];
};
