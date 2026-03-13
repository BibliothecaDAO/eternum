/** Bun text import attribute: `import x from "./file" with { type: "text" }` */
declare module "*.md" {
  const content: string;
  export default content;
}

declare module "*.example" {
  const content: string;
  export default content;
}
