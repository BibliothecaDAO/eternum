export function formatZodError(error) {
    return {
        errors: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
        })),
    };
}
//# sourceMappingURL=zod.js.map