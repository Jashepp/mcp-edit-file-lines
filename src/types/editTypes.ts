// types/editTypes.ts
import { z } from "zod";

// Core edit operation type
export interface EditOperation {
  startLine: number;
  endLine: number;
  content: string;
  strMatch?: string;
  regexMatch?: string;
  preserveIndentation?: boolean;
}

// Schema for individual edit operations
export const EditSchema = z
  .object({
    startLine: z
      .number()
      .int()
      .positive()
      .describe("First line to edit (must be positive)"),
    endLine: z
      .number()
      .int()
      .positive()
      .describe("Last line to edit (must be positive)"),
    content: z.string().describe("New content to insert"),
    strMatch: z
      .string()
      .optional()
      .describe(
        "Optional string to match and replace while preserving line formatting"
      ),
    regexMatch: z
      .string()
      .optional()
      .describe(
        "Optional regex pattern to match and replace while preserving line formatting"
      ),
    preserveIndentation: z
      .boolean()
      .default(true)
      .describe(
        "Rebase content indentation to the target line's indent (true, default). Set false to use content VERBATIM - copy exact indentation from get_file_lines first. default: true"
      )
  })
  .refine((data) => data.startLine <= data.endLine, {
    message: "startLine must not be greater than endLine",
    path: ["startLine"]
  })
  .refine((data) => !(data.strMatch && data.regexMatch), {
    message: "Cannot specify both strMatch and regexMatch",
    path: ["regexMatch"]
  });

// Schema for tool arguments
export const EditFileArgsSchema = z.object({
  p: z.string().describe("Path to the file to edit"),
  e: z.array(EditSchema).describe("Array of edit operations to perform"),
  dryRun: z
    .boolean()
    .default(false)
    .describe("If true, shows diff without applying changes")
});

// Type for edit operation result
export interface EditOperationResult {
  applied: boolean;
  lineContent: string;
  error?: string;
}

// Validation error for when matches aren't found
export class MatchNotFoundError extends Error {
  constructor(
    public readonly line: number,
    public readonly match: string,
    public readonly isRegex: boolean
  ) {
    const matchType = isRegex ? "regex" : "string";
    super(`No ${matchType} match found for "${match}" on line ${line}`);
    this.name = "MatchNotFoundError";
  }
}
