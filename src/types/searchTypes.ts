// types/searchTypes.ts
import { z } from "zod";

export interface SearchMatch {
  line: number;
  content: string;
  context: string;
  match: string;
  index: number;
  column: number;
}

export interface SearchResult {
  matches: SearchMatch[];
  totalMatches: number;
  fileSize: number;
  executionTime: number;
}

export const SearchFileArgsSchema = z.object({
  path: z.string().min(1).describe("Path to the file to search"),
  pattern: z.string().min(1).describe("Search pattern (string or regex)"),
  type: z
    .enum(["text", "regex"])
    .default("text")
    .describe("Type of search to perform. default: text"),
  caseSensitive: z
    .boolean()
    .default(false)
    .describe("Whether search should be case sensitive. default: false"),
  contextLines: z
    .number()
    .int()
    .min(0)
    .max(50)
    .default(2)
    .describe("Number of context lines before and after match. default: 2, max: 50"),
  maxMatches: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(100)
    .describe("Maximum number of matches to return. default: 100, max: 1000"),
  wholeWord: z
    .boolean()
    .default(false)
    .describe("Match whole words only. default: false"),
  multiline: z
    .boolean()
    .default(false)
    .describe("Enable multiline regex mode. default: false"),
  verboseWhitespace: z
    .boolean()
    .default(false)
    .describe("Also render each displayed line with exact whitespace characters: TAB -> \\t, SPACE -> \\s. Use when indentation must be reproduced verbatim. default: false")
});

export type SearchFileArgs = z.infer<typeof SearchFileArgsSchema>;

export enum SearchErrorCode {
  INVALID_PATTERN = "INVALID_PATTERN",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  EXECUTION_TIMEOUT = "EXECUTION_TIMEOUT",
  MAX_MATCHES_EXCEEDED = "MAX_MATCHES_EXCEEDED"
}

export class SearchError extends Error {
  constructor(
    message: string,
    public readonly code: SearchErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "SearchError";
  }
}
