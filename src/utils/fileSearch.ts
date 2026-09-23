// utils/fileSearch.ts
import fs from "fs/promises";
import { performance } from "perf_hooks";
import {
  SearchError,
  SearchErrorCode,
  SearchFileArgs,
  SearchMatch,
  SearchResult
} from "../types/searchTypes.js";
import { normalizeLineEndings } from "./utils.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const EXECUTION_TIMEOUT = 5000; // 5 seconds

/**
 * Get line and column information for a position in text
 */
function getPositionInfo(
  text: string,
  position: number
): { line: number; column: number } {
  const lines = text.slice(0, position).split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

/**
 * Extract context lines around a match
 */
function getContext(
  lines: string[],
  matchLineIdx: number,
  contextLines: number
): string {
  const start = Math.max(0, matchLineIdx - contextLines);
  const end = Math.min(lines.length - 1, matchLineIdx + contextLines);
  return lines.slice(start, end + 1).join("\n");
}

/**
 * Create a regex for text search with proper escaping
 */
function createSearchRegex(args: SearchFileArgs): RegExp {
  let pattern = args.pattern;

  // For text search, escape special regex characters
  if (args.type === "text") {
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Add word boundaries if whole word matching is enabled
    if (args.wholeWord) {
      pattern = `\\b${pattern}\\b`;
    }
  }

  // Always add 'g' flag to enable multiple matches
  const flags = ["g"]; // Changed this line - 'g' flag should always be included
  if (!args.caseSensitive) flags.push("i");
  if (args.multiline) flags.push("m");

  try {
    return new RegExp(pattern, flags.join(""));
  } catch (error) {
    throw new SearchError(
      `Invalid ${args.type} pattern: ${error instanceof Error ? error.message : String(error)}`,
      SearchErrorCode.INVALID_PATTERN,
      { pattern }
    );
  }
}

/**
 * Perform line-by-line search for text patterns
 */
function textSearch(
  lines: string[],
  pattern: RegExp,
  args: SearchFileArgs
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  let terminated = false;

  const timeoutId = setTimeout(() => {
    terminated = true;
    throw new SearchError(
      `Search execution timed out after ${EXECUTION_TIMEOUT}ms`,
      SearchErrorCode.EXECUTION_TIMEOUT
    );
  }, EXECUTION_TIMEOUT);

  try {
    for (let i = 0; i < lines.length && !terminated; i++) {
      const line = lines[i];
      pattern.lastIndex = 0; // Reset lastIndex for each new line

      let match;
      while ((match = pattern.exec(line)) !== null && !terminated) {
        if (matches.length >= args.maxMatches) {
          throw new SearchError(
            `Maximum number of matches (${args.maxMatches}) exceeded`,
            SearchErrorCode.MAX_MATCHES_EXCEEDED,
            { maxMatches: args.maxMatches }
          );
        }

        matches.push({
          line: i + 1,
          column: match.index + 1,
          content: line,
          context: getContext(lines, i, args.contextLines),
          match: match[0],
          index: match.index
        });
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return matches;
}

/**
 * Perform regex search across entire content
 */
function regexSearch(
  content: string,
  lines: string[],
  pattern: RegExp,
  args: SearchFileArgs
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  let terminated = false;

  const timeoutId = setTimeout(() => {
    terminated = true;
    throw new SearchError(
      `Search execution timed out after ${EXECUTION_TIMEOUT}ms`,
      SearchErrorCode.EXECUTION_TIMEOUT
    );
  }, EXECUTION_TIMEOUT);

  try {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null && !terminated) {
      if (matches.length >= args.maxMatches) {
        throw new SearchError(
          `Maximum number of matches (${args.maxMatches}) exceeded`,
          SearchErrorCode.MAX_MATCHES_EXCEEDED,
          { maxMatches: args.maxMatches }
        );
      }

      const { line, column } = getPositionInfo(content, match.index);
      const lineIndex = line - 1;

      matches.push({
        line,
        column,
        content: lines[lineIndex],
        context: getContext(lines, lineIndex, args.contextLines),
        match: match[0],
        index: match.index
      });

      // Prevent infinite loops
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return matches;
}

/**
 * Search file contents using provided pattern and options
 */
export async function searchFile(
  filepath: string,
  args: SearchFileArgs
): Promise<SearchResult> {
  // verboseWhitespace is passed through for handler use; searchFile returns match data only.
  const startTime = performance.now();

  // Validate file size
  const stats = await fs.stat(filepath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new SearchError(
      `File too large (max ${MAX_FILE_SIZE} bytes)`,
      SearchErrorCode.FILE_TOO_LARGE,
      { fileSize: stats.size }
    );
  }

  // Read and normalize file content
  const content = normalizeLineEndings(await fs.readFile(filepath, "utf-8"));
  const lines = content.split("\n");

  // Create appropriate regex for the search
  const pattern = createSearchRegex(args);

  // Perform search based on type
  const matches =
    args.type === "text"
      ? textSearch(lines, pattern, args)
      : regexSearch(content, lines, pattern, args);

  return {
    matches,
    totalMatches: matches.length,
    fileSize: stats.size,
    executionTime: performance.now() - startTime
  };
}
