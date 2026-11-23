import ts from "typescript";

export const VISIBLE_ATTRIBUTES =
  /^(title|aria-label|aria-description|label|placeholder|alt|tooltip|tip|data-tip|description|heading|subtitle|caption|message|hint|detail)$/;

export const VISIBLE_KEYS =
  /^(label|title|text|description|message|tooltip|heading|subtitle|caption|hint|summary|detail|line|reason)$/;

const CODE_ATTRIBUTES =
  /^(className|class|style|key|id|type|href|src|to|role|name|data-(?!tip$)[\w-]+|htmlFor|target|rel)$/;

const CODE_CALLS =
  /^(cn|clsx|classNames|twMerge|cva|require|import|querySelector\w*|getElementById|addEventListener|console\.\w+)$/;

const LOG_CALL = /^(console\.\w+|verboseLog|trace\w*|logger\.\w+)$/;

const CODE_TOKEN =
  /^(?:(?:@\/|\.\.?\/|\/)[\w.$/:-]*|\.[a-z0-9]{1,6}|[a-z0-9_$-]+(?:[_./:][a-z0-9_$-]+)+|[a-z0-9]+-[a-z0-9-]+)$/;

const ERROR_CONSTRUCTOR = /Error$/;

export const calleeName = (call) => {
  const expression = call.expression;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = ts.isIdentifier(expression.expression) ? `${expression.expression.text}.` : "";
    return `${owner}${expression.name.text}`;
  }
  return "";
};

export const templateText = (node) =>
  node.head.text + node.templateSpans.map((span) => `7${span.literal.text}`).join("");

export const isCodeTemplate = (template) =>
  [template.head.text, ...template.templateSpans.map((span) => span.literal.text)].every(
    (piece) => piece === "" || CODE_TOKEN.test(piece),
  );

const isInsideCodeTemplate = (node) => {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isTemplateSpan(up) && isCodeTemplate(up.parent)) return true;
    if (ts.isBlock(up)) break;
  }
  return false;
};

export const isCodeString = (node, { checkCodeTokens = false } = {}) => {
  const parent = node.parent;
  if (!parent) return true;
  const isSimpleLiteral = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  if (isSimpleLiteral && !checkCodeTokens && CODE_TOKEN.test(node.text)) return true;
  if (isSimpleLiteral && isInsideCodeTemplate(node)) return true;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent))
    return true;
  if (ts.isLiteralTypeNode(parent) || (ts.isPropertyAssignment(parent) && parent.name === node)) return true;
  if (ts.isElementAccessExpression(parent) || ts.isCaseClause(parent)) return true;
  if (ts.isBinaryExpression(parent) && /=== |!== |== |!= /.test(` ${parent.operatorToken.getText()} `)) return true;
  if (ts.isJsxAttribute(parent) || (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent))) {
    const attribute = ts.isJsxAttribute(parent) ? parent : parent.parent;
    return CODE_ATTRIBUTES.test(attribute.name.getText());
  }
  for (let up = parent; up; up = up.parent) {
    if (ts.isCallExpression(up) && CODE_CALLS.test(calleeName(up))) return true;
    if (ts.isNewExpression(up) && calleeName(up) === "RegExp") return true;
    if (ts.isJsxAttribute(up)) return CODE_ATTRIBUTES.test(up.name.getText());
    if (ts.isBlock(up) || ts.isSourceFile(up)) break;
  }
  return false;
};

export const inConsole = (node) => {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isCallExpression(up) && LOG_CALL.test(calleeName(up))) return true;
  }
  return false;
};

export const inDiagnostic = (node) => {
  if (inConsole(node)) return true;
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isThrowStatement(up)) return true;
    if (ts.isNewExpression(up) && ERROR_CONSTRUCTOR.test(up.expression.getText())) return true;
  }
  return false;
};

export const playerTextOf = (node, { checkCodeTokens = false } = {}) => {
  if (ts.isJsxText(node)) {
    const text = node.text.trim();
    return text || null;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return !isCodeString(node, { checkCodeTokens }) && !inDiagnostic(node) ? node.text : null;
  }
  if (ts.isTemplateExpression(node)) {
    return !isCodeString(node, { checkCodeTokens }) && !isCodeTemplate(node) && !inDiagnostic(node)
      ? templateText(node)
      : null;
  }
  return null;
};

export const scanPlayerText = (source, fileName, rules, { checkCodeTokens = false } = {}) => {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith("x") ? 4 : 3);
  const matches = [];
  const visit = (node) => {
    const text = playerTextOf(node, { checkCodeTokens });
    if (text !== null) {
      for (const rule of rules) {
        const pattern = rule.pattern ?? rule.forbidden;
        if (pattern?.test(text)) {
          const pos = file.getLineAndCharacterOfPosition(node.getStart(file));
          matches.push({ rule, line: pos.line + 1, column: pos.character, text: text.slice(0, 120) });
          break;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return matches;
};
