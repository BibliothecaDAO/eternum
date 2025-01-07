import * as fs from "fs";
import * as path from "path";

interface Example {
  methodName: string;
  description: string;
  code: string;
  params: Array<{
    name: string;
    description: string;
  }>;
}

function extractExamples(filePath: string): string {
  try {
    // Read the file content
    const content = fs.readFileSync(filePath, "utf8");

    // Pattern to match full JSDoc blocks with examples
    const methodPattern = /\/\*\*\s*([\s\S]*?)\*\/\s*public\s+async\s+([a-zA-Z_]+)/g;
    const paramPattern = /@param\s+props\.([a-zA-Z_]+)\s*-\s*([^\n]+)/g;
    const examplePattern = /@example[\s\S]*?```typescript\n([\s\S]*?)```/;

    const examples: Example[] = [];
    let match: RegExpExecArray | null;

    // Extract all examples
    while ((match = methodPattern.exec(content)) !== null) {
      const docBlock = match[1];
      const methodName = match[2];

      // Get description (first line after /** and before @)
      const description = docBlock.split("\n")[1].trim().replace(/^\* /, "");

      // Get parameters
      const params: Array<{ name: string; description: string }> = [];
      let paramMatch;
      while ((paramMatch = paramPattern.exec(docBlock)) !== null) {
        params.push({
          name: paramMatch[1],
          description: paramMatch[2].trim(),
        });
      }

      // Get example code
      const exampleMatch = docBlock.match(examplePattern);
      if (exampleMatch) {
        const code = exampleMatch[1].trim();
        examples.push({
          methodName,
          description,
          code,
          params,
        });
      }
    }

    // Generate text content
    const text = generateText(examples);

    // Write to file
    const outputPath = path.join(path.dirname(filePath), "provider-examples.ts");
    fs.writeFileSync(outputPath, `export const PROVIDER_EXAMPLES = \`${text}\`;`);

    console.log(`Examples extracted to ${outputPath}`);
    return text;
  } catch (error) {
    console.error("Error processing file:", error);
    return "";
  }
}

function generateText(examples: Example[]): string {
  let text = "Eternum Provider Examples\n\n";

  examples.forEach(({ methodName, description, code, params }) => {
    text += `${methodName}\n`;
    text += "=".repeat(methodName.length) + "\n\n";
    text += `${description}\n\n`;

    text += "Parameters:\n";
    params.forEach((param) => {
      text += `- ${param.name}: ${param.description}\n`;
    });
    text += "\n";

    text += "Example:\n";
    text += code;
    text += "\n\n";
  });

  return text;
}

// Run the extractor
const filePath = path.join(process.cwd(), "../provider/index.ts");
extractExamples(filePath);
