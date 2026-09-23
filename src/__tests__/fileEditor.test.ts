import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { EditOperation, MatchNotFoundError } from "../types/editTypes.js";
import { editFile, formatEditOutput } from "../utils/fileEditor.js";
import { resetFixtures } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testMatchesPath = path.join(__dirname, "fixtures", "test-matches.txt");

describe("FileEditor", () => {
  // Basic edit operations
  describe("Basic Operations", () => {
    it("should replace a single line", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: 'const Button = ({ color = "red", size = "md" }) => {'
      };

      const { diff, results } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain(
        '-const Button = ({ color = "blue", size = "md" }) => {'
      );
      expect(diff).toContain(
        '+const Button = ({ color = "red", size = "md" }) => {'
      );
      expect(results.get(2)?.applied).toBe(true);
    });

    it("should replace multiple lines", async () => {
      const edit: EditOperation = {
        startLine: 7,
        endLine: 12,
        content:
          'export const Card = ({\n  title,\n  description,\n  theme = "dark",\n  size = "sm"\n}) => {'
      };

      const { diff, results } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain("+  description,");
      expect(diff).toContain('+  theme = "dark",');
      expect(diff).toContain('+  size = "sm"');
      expect(results.get(7)?.applied).toBe(true);
    });

    it("should preserve indentation", async () => {
      const edit: EditOperation = {
        startLine: 29,
        endLine: 32,
        content:
          'const API_CONFIG = {\n  baseUrl: "https://api.newexample.com",\n  timeout: 10000\n}'
      };

      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain("+const API_CONFIG = {");
      expect(diff).toContain('+  baseUrl: "https://api.newexample.com",');
      expect(diff).toContain("+  timeout: 10000");
    });

    it("should handle leading whitespace in string matches", async () => {
      const edit: EditOperation = {
        startLine: 16,
        endLine: 16,
        content: "    <div myclass={cardClass}>",
        strMatch: "    <div className={cardClass}>"
      };

      const { diff, results } = await editFile(testMatchesPath, [edit], true);

      expect(diff).toContain("-    <div className={cardClass}>");
      expect(diff).toContain("+    <div myclass={cardClass}>");
      expect(results.get(16)?.applied).toBe(true);
    });

    it("should handle string matches with mixed indentation", async () => {
      const edit: EditOperation = {
        startLine: 17,
        endLine: 17,
        content: "        <h2>{title}</h2>",
        strMatch: "      <h2>{title}</h2>"
      };

      const { diff, results } = await editFile(testMatchesPath, [edit], true);

      expect(diff).toContain("-      <h2>{title}</h2>");
      expect(diff).toContain("+        <h2>{title}</h2>");
      expect(results.get(17)?.applied).toBe(true);
    });
  });

  // String matching operations
  describe("String Matching", () => {
    it("should replace exact string matches", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: '"green"',
        strMatch: '"blue"'
      };

      const { diff, results } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain(
        '+const Button = ({ color = "green", size = "md" }) => {'
      );
      expect(results.get(2)?.applied).toBe(true);
    });

    it("should handle flexible whitespace in string matches", async () => {
      const edit: EditOperation = {
        startLine: 9,
        endLine: 9,
        content: 'description = "Custom description"',
        strMatch: 'subtitle   =   "Default subtitle"'
      };

      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain('+  description = "Custom description"');
    });

    it("should throw error for non-matching strings", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: "new content",
        strMatch: "non-existent content"
      };

      await expect(editFile(testMatchesPath, [edit], true)).rejects.toThrow(
        MatchNotFoundError
      );
    });
  });

  // Regex matching operations
  describe("Regex Matching", () => {
    it("should replace regex matches", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: "warning",
        regexMatch: '(?<=color = ")[^"]*(?=")'
      };

      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain(
        '+const Button = ({ color = "warning", size = "md" }) => {'
      );
    });

    it("should handle regex with capture groups", async () => {
      const edit: EditOperation = {
        startLine: 25,
        endLine: 25,
        content: "${prefix}White = { bg: ${bg}, text: ${text} }",
        regexMatch:
          '(?<prefix>\\w+):\\s*{\\s*bg:\\s*"(?<bg>[^\"]*)",\\s*text:\\s*"(?<text>[^\"]*)"'
      };

      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain("+  lightWhite = { bg: #ffffff, text: #000000 }");
    });

    it("should handle multi-line regex patterns", async () => {
      const edit: EditOperation = {
        startLine: 16,
        endLine: 19,
        content:
          '    <div className={cardClass}>\n      <h2 className="title">{title}</h2>\n      <p className="subtitle">{subtitle}</p>\n    </div>',
        regexMatch: "<div[^>]*>[\\s\\S]*?</div>"
      };

      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain('+      <h2 className="title">{title}</h2>');
      expect(diff).toContain('+      <p className="subtitle">{subtitle}</p>');
    });

    it("should throw error for invalid regex patterns", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: "new content",
        regexMatch: "([" // Invalid regex
      };

      await expect(editFile(testMatchesPath, [edit], true)).rejects.toThrow(
        /Invalid regex pattern/
      );
    });
  });

  // Advanced features and edge cases
  describe("Advanced Features", () => {
    it("should handle overlapping regex patterns", async () => {
      const edits: EditOperation[] = [
        {
          startLine: 2,
          endLine: 2,
          content: "warning",
          regexMatch: '(?<=color = ")[^"]*(?=")'
        },
        {
          startLine: 2,
          endLine: 2,
          content: "danger",
          regexMatch: '"[^"]*"'
        }
      ];

      await expect(editFile(testMatchesPath, edits, true)).rejects.toThrow(
        /Overlapping regex patterns/
      );
    });

    it("should handle look-ahead and look-behind assertions", async () => {
      const edit: EditOperation = {
        startLine: 9,
        endLine: 9,
        content: "NewDefault",
        regexMatch: '(?<="Default )[^"]*(?=")'
      };

      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain('+  subtitle = "Default NewDefault",');
    });

    it("should preserve indentation in multi-line replacements", async () => {
      const edit: EditOperation = {
        startLine: 13,
        endLine: 18,
        content:
          "  const cardStyle = useMemo(() => ({\n    backgroundColor: theme === 'light' ? '#fff' : '#000',\n    padding: size === 'lg' ? '2rem' : '1rem'\n  }), [theme, size]);\n\n  return (",
        regexMatch: "\\s*const cardClass[\\s\\S]*?return \\("
      };

      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toMatch(/^\+\s{2}const cardStyle = useMemo/m);
      expect(diff).toMatch(/^\+\s{4}backgroundColor/m);
      expect(diff).toMatch(/^\+\s{2}\}\), \[theme, size\]\);/m);
    });
  });

  // Error handling
  describe("Error Handling", () => {
    it("should validate line ranges", async () => {
      const edit: EditOperation = {
        startLine: 100,
        endLine: 101,
        content: "invalid line"
      };

      await expect(editFile(testMatchesPath, [edit], true)).rejects.toThrow(
        /Invalid line range/
      );
    });

    it("should prevent multiple non-regex edits on same line", async () => {
      const edits: EditOperation[] = [
        {
          startLine: 2,
          endLine: 2,
          content: "new content 1"
        },
        {
          startLine: 2,
          endLine: 2,
          content: "new content 2"
        }
      ];

      await expect(editFile(testMatchesPath, edits, true)).rejects.toThrow(
        /Line 2 is affected by multiple non-regex edits/
      );
    });

    it("should validate start line is not greater than end line", async () => {
      const edit: EditOperation = {
        startLine: 5,
        endLine: 3,
        content: "invalid range"
      };

      await expect(editFile(testMatchesPath, [edit], true)).rejects.toThrow(
        /start line .* is greater than end line/
      );
    });
  });

  // Dry run functionality
  describe("Dry Run", () => {
    afterEach(async () => {
      await resetFixtures();
    });

    it("should not modify file in dry run mode", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: 'const Button = ({ color = "red", size = "md" }) => {'
      };

      await editFile(testMatchesPath, [edit], true);
      const content = await fs.readFile(testMatchesPath, "utf-8");
      const originalContent = await fs.readFile(testMatchesPath, "utf-8");
      expect(content).toBe(originalContent);
    });

    it("should modify file when dry run is false", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: 'const Button = ({ color = "red", size = "md" }) => {'
      };

      await editFile(testMatchesPath, [edit], false);
      const content = await fs.readFile(testMatchesPath, "utf-8");
      expect(content).toContain('color = "red"');
    });
  });

  // preserveIndentation flag tests
  describe("preserveIndentation Flag", () => {
    it("should keep exact indentation verbatim when false (a)", async () => {
      // File uses 2-space indentation on line 2; content uses 4-space
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: "    const Button = ({ color = 'purple', size = 'xl' }) => {}",
        preserveIndentation: false
      };
      const { diff } = await editFile(testMatchesPath, [edit], true);
      // Content should use 4 spaces, not rebased to 0 (file's indentation on line 2)
      expect(diff).toContain(
        "+    const Button = ({ color = 'purple', size = 'xl' }) => {}"
      );
    });

    it("should keep blank lines empty when false (b)", async () => {
      // Multi-line content with blank line in middle
      const edit: EditOperation = {
        startLine: 7,
        endLine: 7,
        content: "export const Card = ({ title });\n\nexport const Helper = () => {}",
        preserveIndentation: false
      };
      const { diff } = await editFile(testMatchesPath, [edit], true);
      // Blank line should be truly empty (no trailing spaces)
      expect(diff).toContain(
        "+export const Card = ({ title });"
      );
      // The blank line becomes a separate hunk line (just "+") - assert no "  " after it
      const blankLineRegex = /\+export const Card = \(\{ title \}\);[\s\S]*\n\+\n/;
      expect(diff).toMatch(blankLineRegex);
    });

    it("should keep strMatch span replacement verbatim when false (c)", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: "    'purple'",
        strMatch: '"blue"',
        preserveIndentation: false
      };
      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain(
        "+const Button = ({ color =     'purple', size = \"md\" }) => {"
      );
    });

    it("should keep blank line blank when true (d)", async () => {
      // Multi-line content with a blank line inside; should stay blank with default (true)
      const edit: EditOperation = {
        startLine: 7,
        endLine: 7,
        content:
          "export const Card = ({ title });\n\n  // helper comment"
      };
      const { diff } = await editFile(testMatchesPath, [edit], true);
      // The middle blank line must be truly empty (no leading spaces)
      const blankLineRegex =
        /^\+export const Card = \(\{ title \}\);[\s\S]*^\+[\s\S]*^\+\s{2}\/\/ helper comment$/m;
      expect(diff).toMatch(blankLineRegex);
    });

    it("should preserve prefix/suffix when strMatch matches mid-line span with single-line content (e - RC2)", async () => {
      const edit: EditOperation = {
        startLine: 9,
        endLine: 9,
        content: "New subtitle text",
        strMatch: "Default subtitle"
      };
      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain(
        '+  subtitle = "New subtitle text",'
      );
    });

    it("should replace span mid-line with multi-line content and preserve prefix/suffix (e2)", async () => {
      // The line is:   subtitle = "Default subtitle",
      // strMatch matches mid-line span; content has newlines
      const edit: EditOperation = {
        startLine: 9,
        endLine: 9,
        content: '"First line"\n"Second line"',
        strMatch: 'Default subtitle"'
      };
      const { diff } = await editFile(testMatchesPath, [edit], true);
      expect(diff).toContain('+  subtitle = "  "First line"');
      expect(diff).toContain('  "Second line",');
    });

    it("should not modify file in dry run mode (regression)", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: 'const Button = ({ color = "red", size = "md" }) => {'
      };

      await editFile(testMatchesPath, [edit], true);
      const content = await fs.readFile(testMatchesPath, "utf-8");
      expect(content).toContain('color = "blue"');
    });
  });

  // Line map / Result tests
  describe("Line Map and Result", () => {
    it("should report replace operation with 1 line added, 1 line removed (f)", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: 'const Button = ({ color = "purple", size = "xl" }) => {'
      };
      const { diff, lineMap } = await editFile(testMatchesPath, [edit], true);
      const formatted = formatEditOutput(diff, lineMap);
      expect(formatted).toContain(
        "Result: 1 line added, 1 line removed"
      );
      expect(formatted).toContain("REMOVE 2: ");
      expect(formatted).toContain("ADD 2: ");
      expect(lineMap.added).toBe(1);
      expect(lineMap.removed).toBe(1);
    });

    it("should report insert operation with N lines added, 1 removed (g)", async () => {
      // Replace single line with 3 lines (insertion effect)
      const edit: EditOperation = {
        startLine: 5,
        endLine: 5,
        content: "// inserted line 1\n// inserted line 2\n// inserted line 3"
      };
      const { diff, lineMap } = await editFile(testMatchesPath, [edit], true);
      const formatted = formatEditOutput(diff, lineMap);
      expect(formatted).toContain("Result: 3 lines added, 1 line removed");
      expect(lineMap.added).toBe(3);
      expect(lineMap.removed).toBe(1);
    });

    it("should report delete operation with 1 line added, N removed (h)", async () => {
      // Replace 4 lines with empty string (becomes blank line)
      const edit: EditOperation = {
        startLine: 7,
        endLine: 10,
        content: ""
      };
      const { diff, lineMap } = await editFile(testMatchesPath, [edit], true);
      const formatted = formatEditOutput(diff, lineMap);
      expect(formatted).toContain("Result: 1 line added, 4 lines removed");
      expect(lineMap.added).toBe(1);
      expect(lineMap.removed).toBe(4);
    });

    it("should report no-op edit with 0 lines added, 0 removed (i)", async () => {
      const edit: EditOperation = {
        startLine: 2,
        endLine: 2,
        content: 'const Button = ({ color = "blue", size = "md" }) => {'
      };
      const { diff, lineMap } = await editFile(testMatchesPath, [edit], true);
      const formatted = formatEditOutput(diff, lineMap);
      expect(formatted).toContain(
        "Result: 0 lines added, 0 lines removed"
      );
      expect(lineMap.lines).toEqual([]);
      expect(lineMap.added).toBe(0);
      expect(lineMap.removed).toBe(0);
    });

    it("should truncate line map when >100 lines (j)", async () => {
      // Build a large edit: replace 10 lines with 120 lines
      const originalLines = 10;
      const edit: EditOperation = {
        startLine: 7,
        endLine: 10,
        content: Array.from({ length: 120 }, (_, i) => `line ${i + 1}`).join("\n")
      };
      const { diff, lineMap } = await editFile(testMatchesPath, [edit], true);
      const formatted = formatEditOutput(diff, lineMap);
      expect(formatted).toMatch(/\.\.\. \(\d+ lines omitted\) \.\.\./);
      // Verify truncation structure
      expect(lineMap.lines.length).toBe(101); // 50 + 1 + 50
    });
  });
});
