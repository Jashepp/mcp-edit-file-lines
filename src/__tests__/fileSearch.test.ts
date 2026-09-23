import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { searchFile } from "../utils/fileSearch.js";
import { renderWhitespace, WHITESPACE_LEDGER } from "../utils/utils.js";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to test file
const testFilePath = join(__dirname, "fixtures", "sample.txt");

describe("searchFile", () => {
  it("should find matches in a file", async () => {
    const result = await searchFile(testFilePath, {
      path: testFilePath,
      pattern: "line 2",
      type: "text",
      caseSensitive: false,
      contextLines: 1,
      maxMatches: 10,
      wholeWord: false,
      multiline: false,
      verboseWhitespace: false,
    });

    expect(result.totalMatches).toBe(1);
    expect(result.matches[0].line).toBe(2);
    expect(result.matches[0].match).toBe("line 2");
  });

  it("should find context lines around matches", async () => {
    const result = await searchFile(testFilePath, {
      path: testFilePath,
      pattern: "line 3",
      type: "text",
      caseSensitive: false,
      contextLines: 1,
      maxMatches: 10,
      wholeWord: false,
      multiline: false,
      verboseWhitespace: false,
    });

    expect(result.totalMatches).toBe(1);
    expect(result.matches[0].line).toBe(3);
    expect(result.matches[0].context).toContain("line 2");
    expect(result.matches[0].context).toContain("line 3");
    expect(result.matches[0].context).toContain("line 4");
  });

  it("should accept verboseWhitespace:true in args", async () => {
    const result = await searchFile(testFilePath, {
      path: testFilePath,
      pattern: "line 3",
      type: "text",
      caseSensitive: false,
      contextLines: 1,
      maxMatches: 10,
      wholeWord: false,
      multiline: false,
      verboseWhitespace: true,
    });

    expect(result.totalMatches).toBe(1);
    expect(result.matches[0].line).toBe(3);
  });
});

describe("search_file verboseWhitespace formatting", () => {
  async function formatSearchResult(
    filePath: string,
    args: { type?: "text" | "regex"; pattern: string; contextLines?: number; maxMatches?: number; verboseWhitespace?: boolean }
  ): Promise<string> {
    const result = await searchFile(filePath, {
      path: filePath,
      type: args.type ?? "text",
      pattern: args.pattern,
      contextLines: args.contextLines ?? 2,
      maxMatches: args.maxMatches ?? 100,
      caseSensitive: false,
      wholeWord: false,
      multiline: false,
      verboseWhitespace: args.verboseWhitespace ?? false,
    });

    const output = [
      `Found ${result.totalMatches} matches in ${result.executionTime.toFixed(1)}ms:`,
      `File size: ${(result.fileSize / 1024).toFixed(1)}KB`,
      "",
    ];

    const shownLines = new Map<number, string>();

    result.matches.forEach((match, i) => {
      output.push(
        `Match ${i + 1}: Line ${match.line}, Column ${match.column}`,
        "----------------------------------------"
      );

      const contextLines = match.context.split("\n");
      const matchLineIndex = contextLines.findIndex(
        (line) => line === match.content
      );
      const startLineNumber = match.line - matchLineIndex;

      contextLines.forEach((line, idx) => {
        const lineNumber = startLineNumber + idx;
        const linePrefix = lineNumber.toString().padStart(4, " ");
        const indicator = lineNumber === match.line ? ">" : " ";
        output.push(`${indicator} ${linePrefix} | ${line}`);
        shownLines.set(lineNumber, line);
      });

      output.push("");
    });

    if (args.verboseWhitespace) {
      output.push("", WHITESPACE_LEDGER);
      for (const [lineNumber, line] of [...shownLines.entries()].sort((a, b) => a[0] - b[0])) {
        output.push(`  ${lineNumber}: ${renderWhitespace(line)}`);
      }
    }

    return output.join("\n");
  }

  it("should include legend and rendered lines when verboseWhitespace is true", async () => {
    const output = await formatSearchResult(testFilePath, {
      type: "text",
      pattern: "line 3",
      contextLines: 1,
      maxMatches: 10,
      verboseWhitespace: true,
    });

    expect(output).toContain(WHITESPACE_LEDGER);
    expect(output).toContain("  2: line\\s2");
    expect(output).toContain("  3: line\\s3");
    expect(output).toContain("  4: line\\s4");
  });

  it("should NOT include legend when verboseWhitespace is false", async () => {
    const output = await formatSearchResult(testFilePath, {
      type: "text",
      pattern: "line 3",
      contextLines: 1,
      maxMatches: 10,
      verboseWhitespace: false,
    });

    expect(output).not.toContain(WHITESPACE_LEDGER);
  });
});
