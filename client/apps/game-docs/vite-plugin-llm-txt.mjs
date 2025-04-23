import fg from "fast-glob";
import { remarkInclude } from "fumadocs-mdx/config";
import matter from "gray-matter";
import * as fs from "node:fs";
import * as path from "node:path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";

// Resolve paths relative to the config file's location
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const docsDir = path.resolve(__dirname, "docs");
const publicDir = path.resolve(__dirname, "../../public"); // Assumes public dir is client/public
const botDir = path.resolve(__dirname, "../bot"); // New output directory
const outputFile = path.resolve(publicDir, "llm.txt");
const botOutputFile = path.resolve(botDir, "llm.txt"); // New output file path

const processor = remark().use(remarkMdx).use(remarkInclude).use(remarkGfm).use(remarkStringify);

export default function llmTxtPlugin() {
  return {
    name: "vite-plugin-llm-txt",
    // Run before the build starts
    async buildStart() {
      console.log("Generating llm.txt...");
      try {
        // Ensure public directory exists
        await fs.promises.mkdir(publicDir, { recursive: true });

        // Find all .mdx files within the docs directory
        const files = await fg([`${docsDir}/**/*.mdx`], { absolute: true });
        console.log(`Found ${files.length} mdx files.`);

        const scan = files.map(async (file) => {
          const fileContent = await fs.promises.readFile(file, "utf-8");
          const { content, data } = matter(fileContent);

          // Use relative path for remark processing if needed
          const relativePath = path.relative(process.cwd(), file);

          const processed = await processor.process({
            path: relativePath, // Use relative path for includes
            value: content,
          });

          // Create relative path from docsDir for output clarity
          const relativeFilePath = path.relative(docsDir, file);

          return `file: docs/${relativeFilePath}
meta: ${JSON.stringify(data, null, 2)}

${processed.toString()}
`;
        });

        const scanned = await Promise.all(scan);
        const combinedContent = scanned.join("\n\n---\n\n"); // Separator between files

        await fs.promises.writeFile(outputFile, combinedContent);
        // Also write to the bot directory
        await fs.promises.mkdir(botDir, { recursive: true }); // Ensure bot directory exists
        await fs.promises.writeFile(botOutputFile, combinedContent);

        console.log(`Successfully generated llm.txt at ${outputFile} and ${botOutputFile}`);
      } catch (error) {
        console.error("Error generating llm.txt:", error);
      }
    },
  };
}
