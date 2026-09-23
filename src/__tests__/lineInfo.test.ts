import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getLineInfo } from "../utils/lineInfo.js";
import { renderWhitespace, WHITESPACE_LEDGER } from "../utils/utils.js";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to test file
const testFilePath = join(__dirname, "fixtures", "sample.txt");

describe("lineInfo", () => {
  it("should return correct line information", async () => {
    const result = await getLineInfo(testFilePath, [2, 4], 1);

    expect(result).toContain("Line 2:");
    expect(result).toContain("> 2: line 2");
    expect(result).toContain(" 1: line 1");
    expect(result).toContain(" 3: line 3");
    expect(result).toContain("Line 4:");
    expect(result).toContain("> 4: line 4");
  });

  it("should handle invalid line numbers", async () => {
    const result = await getLineInfo(testFilePath, [0, 6], 0);

    expect(result).toContain("Invalid line number");
    expect(result).toContain("file has 5 lines");
  });

  it("should handle zero context lines", async () => {
    const result = await getLineInfo(testFilePath, [2], 0);

    expect(result).toContain("Line 2:");
    expect(result).toContain("> 2: line 2");
    expect(result.split("\n").length).toBe(3); // Line number, content, empty line
  });

  it("should handle files with empty lines", async () => {
    const result = await getLineInfo(testFilePath, [5], 0);

    expect(result).toContain("Line 5:");
    expect(result).toContain("> 5: line 5");
  });
});

describe("renderWhitespace", () => {
  it("should render 4 leading spaces as \\s\\s\\s\\s", () => {
    expect(renderWhitespace("    Hello")).toBe("\\s\\s\\s\\sHello");
  });

  it("should render a tab character as \\t", () => {
    expect(renderWhitespace("\tworld")).toBe("\\tworld");
  });

  it("should render 3 trailing spaces as line\\s\\s\\s", () => {
    expect(renderWhitespace("line   ")).toBe("line\\s\\s\\s");
  });

  it("should render U+00A0 (NO-BREAK SPACE) as [U+00A0]", () => {
    expect(renderWhitespace("a\u00a0b")).toBe("a[U+00A0]b");
  });
});

describe("WHITESPACE_LEDGER", () => {
  it("should be the exact legend string", () => {
    expect(WHITESPACE_LEDGER).toBe(
      "Legend: \\t = TAB, \\s = SPACE, \\r = CR, [U+XXXX] = other whitespace"
    );
  });
});

describe("get_file_lines verboseWhitespace", () => {
  it("should append legend and rendered lines when verboseWhitespace is true", async () => {
    const result = await getLineInfo(testFilePath, [2], 1, true);
    const lines = result.split("\n");

    // Should contain the normal output
    expect(result).toContain("Line 2:");
    expect(result).toContain("> 2: line 2");

    // Should contain the legend
    expect(result).toContain(WHITESPACE_LEDGER);

    // After the legend, should have rendered lines (2 lines: 1, 2, 3 due to context)
    const legendIndex = lines.findIndex((l) => l === WHITESPACE_LEDGER);
    expect(legendIndex).toBeGreaterThanOrEqual(0);

    // Should have rendered lines after the legend
    expect(lines[legendIndex + 1]).toBe("  1: line\\s1");
    expect(lines[legendIndex + 2]).toBe("  2: line\\s2");
    expect(lines[legendIndex + 3]).toBe("  3: line\\s3");
  });

  it("should NOT append legend when verboseWhitespace is false", async () => {
    const result = await getLineInfo(testFilePath, [2], 1, false);
    expect(result).not.toContain(WHITESPACE_LEDGER);
  });
});
