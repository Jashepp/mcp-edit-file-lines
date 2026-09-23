#!/usr/bin/env node
import fs from "fs/promises";
import os from "os";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { EditFileArgsSchema, EditOperation } from "./types/editTypes.js";
import { SearchError, SearchFileArgsSchema } from "./types/searchTypes.js";
import { approveEdit } from "./utils/approveEdit.js";
import {
  editFile,
  formatEditOutput,
  insertFileLines,
  deleteFileLines
} from "./utils/fileEditor.js";
import { searchFile } from "./utils/fileSearch.js";
import { getLineInfo } from "./utils/lineInfo.js";
import { renderWhitespace, WHITESPACE_LEDGER } from "./utils/utils.js";
import { StateManager } from "./utils/stateManager.js";
import { initForceDryRun, forceDryRun, checkForceDryRun } from "./utils/forceDryRun.js";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

// Initialize force-dry-run mode from CLI arguments
initForceDryRun();

// Command line argument parsing
const args = process.argv.slice(2);

// Filter out CLI flags (any argument starting with -- that has no /, \, or .)
const allowedDirs = args.filter((a) => !(a.startsWith("--") && !a.includes("/") && !a.includes("\\") && !a.includes(".")));

if (allowedDirs.length === 0) {
  console.error(
    "Usage: ./build/index.js <allowed-directory> [additional-directories...]"
  );
  process.exit(1);
}

// Normalize paths and expand home directory
function normalizePath(p: string): string {
  return path.normalize(p).toLowerCase();
}

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

// Store allowed directories in normalized form
const allowedDirectories = allowedDirs.map((dir) =>
  normalizePath(path.resolve(expandHome(dir)))
);

// Validate directories
await Promise.all(
  allowedDirs.map(async (dir) => {
    try {
      const stats = await fs.stat(dir);
      if (!stats.isDirectory()) {
        console.error(`Error: ${dir} is not a directory`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error accessing directory ${dir}:`, error);
      process.exit(1);
    }
  })
);

// Path validation
async function validatePath(requestedPath: string): Promise<string> {
  const expandedPath = expandHome(requestedPath);
  const absolute = path.isAbsolute(expandedPath)
    ? path.resolve(expandedPath)
    : path.resolve(process.cwd(), expandedPath);

  const normalizedRequested = normalizePath(absolute);

  const isAllowed = allowedDirectories.some((dir) =>
    normalizedRequested.startsWith(dir)
  );
  if (!isAllowed) {
    throw new Error(
      `Access denied - path outside allowed directories: ${absolute}`
    );
  }

  try {
    const realPath = await fs.realpath(absolute);
    const normalizedReal = normalizePath(realPath);
    const isRealPathAllowed = allowedDirectories.some((dir) =>
      normalizedReal.startsWith(dir)
    );
    if (!isRealPathAllowed) {
      throw new Error(
        "Access denied - symlink target outside allowed directories"
      );
    }
    return realPath;
  } catch (error) {
    const parentDir = path.dirname(absolute);
    try {
      const realParentPath = await fs.realpath(parentDir);
      const normalizedParent = normalizePath(realParentPath);
      const isParentAllowed = allowedDirectories.some((dir) =>
        normalizedParent.startsWith(dir)
      );
      if (!isParentAllowed) {
        throw new Error(
          "Access denied - parent directory outside allowed directories"
        );
      }
      return absolute;
    } catch {
      throw new Error(`Parent directory does not exist: ${parentDir}`);
    }
  }
}

// Schema for get_line_info
const GetLineInfoArgsSchema = z.object({
  path: z.string().describe("Path to the file to get line info for"),
  lineNumbers: z
    .array(z.number().int().min(1))
    .describe("Line numbers to get info for"),
  context: z
    .number()
    .int()
    .min(0)
    .default(2)
    .describe("Number of context lines before and after. default: 2"),
  verboseWhitespace: z
    .boolean()
    .default(false)
    .describe("Also render each displayed line with exact whitespace characters: TAB -> \\t, SPACE -> \\s. Use when indentation must be reproduced verbatim. default: false")
});

// Add to server setup section
const stateManager = new StateManager();

// Server setup
const server = new Server(
  {
    name: "edit-file-lines",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "edit_file_lines",
        description: `Make line-based edits to a file. Each edit operation can:
- Replace entire lines when no match criteria is specified
- Replace specific text matches while preserving line formatting (using strMatch)
- Replace regex matches while preserving line formatting (using regexMatch)
- Handle multiple lines with full content replacement
When dryRun is true, returns a diff and a stateId that can be used with approve_edit tool to apply the edit.
The stateId is only valid for 1 minute.
To INSERT lines use add_file_lines; to DELETE lines use remove_file_lines. Set preserveIndentation:false when your content carries exact indentation copied from get_file_lines.`,
        inputSchema: zodToJsonSchema(EditFileArgsSchema) as ToolInput
      },
      {
        name: "approve_edit",
        description:
          "Approve and apply a previously validated edit from a dry run with edit_file_lines call using its stateId.",
        inputSchema: zodToJsonSchema(
          z.object({
            stateId: z
              .string()
              .describe("State ID returned from a dry run edit_file_lines call")
          })
        ) as ToolInput
      },
      {
        name: "get_file_lines",
        description:
          "Get information about specific line numbers in a file, including their content " +
          "and optional context lines. Useful for verifying line numbers before making edits. " +
          "Only works within allowed directories. " +
          "Pass verboseWhitespace:true to see TAB/SPACE characters exactly (needed before composing preserveIndentation:false content).",
        inputSchema: zodToJsonSchema(GetLineInfoArgsSchema) as ToolInput
      },
      {
        name: "search_file",
        description: `Search a file for text or regex patterns and return line numbers, content, and surrounding context. Useful for finding exact locations before making edits with edit_file_lines. Features:
    - Simple text search with optional case sensitivity
    - Regular expression support with multiline mode
    - Whole word matching option
    - Configurable context lines
    - Returns line numbers, content, and surrounding context
Pass verboseWhitespace:true to see TAB/SPACE characters exactly (needed before composing preserveIndentation:false content).`,
        inputSchema: zodToJsonSchema(SearchFileArgsSchema) as ToolInput
      },
      {
        name: "add_file_lines",
        description: `INSERT new line(s) after a given line number without removing anything. afterLine=0 inserts at file start. Use this to ADD lines - never replace a line with 'old line + new line' via edit_file_lines (that pattern deletes the original line by accident). Pure insertion: the line map will show ADD and KEEP lines only, no REMOVE.`,
        inputSchema: zodToJsonSchema(
          z.object({
            p: z.string().describe("Absolute file path"),
            afterLine: z.number().int().describe("Insert after this line number; 0 = start of file (before line 1)"),
            content: z.string().describe("New line(s) to insert, multi-line allowed"),
            dryRun: z.boolean().default(false).describe("Show diff without writing")
          })
        ) as ToolInput
      },
      {
        name: "remove_file_lines",
        description: "DELETE a range of lines (startLine..endLine inclusive). Pure removal: the line map will show only REMOVE and KEEP lines, no ADD.",
        inputSchema: zodToJsonSchema(
          z.object({
            p: z.string().describe("Absolute file path"),
            startLine: z.number().int().describe("First line to delete"),
            endLine: z.number().int().describe("Last line to delete (inclusive)"),
            dryRun: z.boolean().default(false).describe("Show diff without writing")
          })
        ) as ToolInput
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === "edit_file_lines") {
      const parsed = EditFileArgsSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(
          `Invalid arguments: ${JSON.stringify(parsed.error.errors, null, 2)}`
        );
      }

      const dryRunError = checkForceDryRun(parsed.data.dryRun);
      if (dryRunError) {
        return { content: [dryRunError] };
      }

      try {
        const validPath = await validatePath(parsed.data.p);

        // Convert array-style edits to object style
        const edits: EditOperation[] = parsed.data.e;

        const { diff, lineMap } = await editFile(
          validPath,
          edits,
          parsed.data.dryRun
        );
        const formatted = formatEditOutput(diff, lineMap);

        // For dry run, save state and return stateId
        if (parsed.data.dryRun) {
          const stateId = stateManager.saveState(validPath, parsed.data.e);
          return {
            content: [
              {
                type: "text",
                text: `${formatted}\nState ID: ${stateId}\nUse this ID with approve_edit to apply the changes.`
              }
            ]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: formatted
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    if (name === "approve_edit") {
      const parsed = z.object({ stateId: z.string() }).safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid arguments: ${parsed.error}`);
      }

      try {
        const result = await approveEdit(parsed.data.stateId, stateManager);
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    if (name === "get_file_lines") {
      const parsed = GetLineInfoArgsSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(
          `Invalid arguments for get_file_lines: ${parsed.error}`
        );
      }

      try {
        const validPath = await validatePath(parsed.data.path);
        const result = await getLineInfo(
          validPath,
          parsed.data.lineNumbers,
          parsed.data.context,
          parsed.data.verboseWhitespace
        );
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    if (name === "search_file") {
      const parsed = SearchFileArgsSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(
          `Invalid arguments: ${JSON.stringify(parsed.error.errors, null, 2)}`
        );
      }

      try {
        const validPath = await validatePath(parsed.data.path);
        const result = await searchFile(validPath, parsed.data);

        // Format results for display
        const output = [
          `Found ${result.totalMatches} matches in ${result.executionTime.toFixed(1)}ms:`,
          `File size: ${(result.fileSize / 1024).toFixed(1)}KB`,
          ""
        ];

        const shownLines = new Map<number, string>();

        result.matches.forEach((match, i) => {
          output.push(
            `Match ${i + 1}: Line ${match.line}, Column ${match.column}`,
            "----------------------------------------"
          );

          // Split context into lines and get the matched line index
          const contextLines = match.context.split("\n");
          const matchLineIndex = contextLines.findIndex(
            (line) => line === match.content
          );
          const startLineNumber = match.line - matchLineIndex;

          // Add each context line with line number
          contextLines.forEach((line, idx) => {
            const lineNumber = startLineNumber + idx;
            const linePrefix = lineNumber.toString().padStart(4, " ");
            const indicator = lineNumber === match.line ? ">" : " ";
            output.push(`${indicator} ${linePrefix} | ${line}`);
            shownLines.set(lineNumber, line);
          });

          output.push(""); // Empty line between matches
        });

        if (parsed.data.verboseWhitespace) {
          output.push("", WHITESPACE_LEDGER);
          for (const [lineNumber, line] of [...shownLines.entries()].sort((a, b) => a[0] - b[0])) {
            output.push(`  ${lineNumber}: ${renderWhitespace(line)}`);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: output.join("\n")
            }
          ]
        };
      } catch (error) {
        if (error instanceof SearchError) {
          const details = error.details
            ? `\nDetails: ${JSON.stringify(error.details, null, 2)}`
            : "";

          return {
            content: [
              {
                type: "text",
                text: `Search error: ${error.message}${details}`
              }
            ],
            isError: true
          };
        }
        throw error;
      }
    }

    if (name === "add_file_lines") {
      const parsed = z
        .object({
          p: z.string(),
          afterLine: z.number().int(),
          content: z.string(),
          dryRun: z.boolean().optional()
        })
        .safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid arguments: ${parsed.error} `);
      }

      const dryRunError = checkForceDryRun(parsed.data.dryRun ?? false);
      if (dryRunError) {
        return { content: [dryRunError] };
      }

      try {
        const validPath = await validatePath(parsed.data.p);
        const { afterLine, content } = parsed.data;
        const dryRun = parsed.data.dryRun ?? false;

        if (dryRun) {
          const stateId = stateManager.saveAddState(validPath, afterLine, content);
          const result = await insertFileLines(validPath, afterLine, content, true);
          return {
            content: [
              {
                type: "text",
                text: formatEditOutput(result.diff, result.lineMap) + "\nState ID: " + stateId
              }
            ]
          };
        }

        const result = await insertFileLines(validPath, afterLine, content, false);
        return {
          content: [{ type: "text", text: formatEditOutput(result.diff, result.lineMap) }]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    if (name === "remove_file_lines") {
      const parsed = z
        .object({
          p: z.string(),
          startLine: z.number().int(),
          endLine: z.number().int(),
          dryRun: z.boolean().optional()
        })
        .safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid arguments: ${parsed.error} `);
      }

      const dryRunError = checkForceDryRun(parsed.data.dryRun ?? false);
      if (dryRunError) {
        return { content: [dryRunError] };
      }

      try {
        const validPath = await validatePath(parsed.data.p);
        const { startLine, endLine } = parsed.data;
        const dryRun = parsed.data.dryRun ?? false;

        if (dryRun) {
          const stateId = stateManager.saveRemoveState(validPath, startLine, endLine);
          const result = await deleteFileLines(validPath, startLine, endLine, true);
          return {
            content: [
              {
                type: "text",
                text: formatEditOutput(result.diff, result.lineMap) + "\nState ID: " + stateId
              }
            ]
          };
        }

        const result = await deleteFileLines(validPath, startLine, endLine, false);
        return {
          content: [{ type: "text", text: formatEditOutput(result.diff, result.lineMap) }]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true
    };
  }
});

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Edit File Lines Server running on stdio");
  console.error("Allowed directories:", allowedDirectories);
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
