import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const SRC_DIR = path.join(projectRoot, "src");
const ENTRYPOINTS = [path.join(SRC_DIR, "main.tsx")];

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"]; // json for resolveJsonModule

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function normalize(p) {
  return p.replaceAll("\\", "/");
}

function listAllFiles(dir) {
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      // Skip node_modules, dist, build artifacts
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function tryResolveAsFile(basePath) {
  if (isFile(basePath)) return basePath;
  for (const ext of EXTENSIONS) {
    const candidate = basePath + ext;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function tryResolveAsDirectory(dirPath) {
  if (!isDirectory(dirPath)) return null;
  // Prefer index files
  for (const ext of EXTENSIONS) {
    const candidate = path.join(dirPath, "index" + ext);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function resolveImport(fromFile, spec) {
  // only handle local relative imports; external packages are irrelevant for src reachability
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;

  const fromDir = path.dirname(fromFile);

  // For absolute-style "/src/..." or "/assets/..." treat as project-root relative
  const rawTarget = spec.startsWith("/") ? path.join(projectRoot, spec.slice(1)) : path.resolve(fromDir, spec);

  // TS paths may include extensions already
  const asFile = tryResolveAsFile(rawTarget);
  if (asFile) return asFile;

  const asDirIndex = tryResolveAsDirectory(rawTarget);
  if (asDirIndex) return asDirIndex;

  // Some imports may point into folders (e.g., "../components")
  // or omit extension with nested index.
  return null;
}

function getImportSpecs(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  /** @type {string[]} */
  const specs = [];

  /** @param {ts.Node} node */
  function visit(node) {
    // import ... from "x"
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text);
    }

    // export ... from "x"
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text);
    }

    // import("x")
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteral(arg)) specs.push(arg.text);
    }

    // require("x")
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specs;
}

function isInSrc(filePath) {
  const rel = path.relative(SRC_DIR, filePath);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function main() {
  const allSrcFiles = listAllFiles(SRC_DIR)
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return [".ts", ".tsx", ".js", ".jsx", ".json"].includes(ext);
    })
    .map((f) => path.resolve(f));

  /** @type {Set<string>} */
  const reachable = new Set();
  /** @type {string[]} */
  const queue = ENTRYPOINTS.map((f) => path.resolve(f));

  while (queue.length) {
    const current = queue.pop();
    if (!current) continue;
    if (reachable.has(current)) continue;
    if (!isFile(current)) continue;

    reachable.add(current);

    const ext = path.extname(current).toLowerCase();
    // Only parse source-like files for imports
    if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"].includes(ext)) continue;

    const specs = getImportSpecs(current);
    for (const spec of specs) {
      const resolved = resolveImport(current, spec);
      if (!resolved) continue;
      // Only follow into src to avoid pulling node_modules or public
      if (!isInSrc(resolved)) continue;
      if (!reachable.has(resolved)) queue.push(resolved);
    }
  }

  const unreachable = allSrcFiles.filter((f) => !reachable.has(f));

  // Print results in a stable, readable way
  const fmt = (p) => normalize(path.relative(projectRoot, p));
  const reachableCount = reachable.size;

  console.log(JSON.stringify({
    projectRoot: normalize(projectRoot),
    entrypoints: ENTRYPOINTS.map(fmt),
    reachableCount,
    totalSrcFiles: allSrcFiles.length,
    unreachableCount: unreachable.length,
    unreachable: unreachable.map(fmt).sort(),
  }, null, 2));
}

main();
