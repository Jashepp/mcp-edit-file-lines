# Edit File Lines MCP Server

A TypeScript-based MCP server providing 6 tools for precise file editing: line-based edits with dry-run preview, dedicated insert/delete tools, exact whitespace rendering, and structural line-map output. All operations restricted to allowed directories.

## Features

| Tool | Purpose |
|------|---------|
| `edit_file_lines` | Replace text/lines with pattern matching, dry-run preview, line-map output |
| `add_file_lines` | Insert new line(s) after a given line (pure insert, never deletes) |
| `remove_file_lines` | Delete a range of lines (pure remove, never adds) |
| `get_file_lines` | View specific lines with context, optional exact-whitespace rendering |
| `search_file` | Find text/regex across a file, optional exact-whitespace rendering |
| `approve_edit` | Apply a previously dry-run edit / add / remove operation via its state ID |

- **Dry-run workflow:** preview with `"dryRun": true` (returns state ID), inspect the diff/line map, then call `approve_edit` to apply.
- **Line map output:** every edit/add/remove operation outputs `Result:` (add/remove counts) and a `Line map:` showing each changed line as `KEEP` / `REMOVE` / `ADD` with line numbers, making deletions and additions instantly visible.
- **Exact whitespace:** `verboseWhitespace: true` on `get_file_lines` and `search_file` renders TAB as `\t` and SPACE as `\s`, so indentation can be reproduced verbatim (use `preserveIndentation: false` in edits for byte-exact results).
- **Indentation control:** per-edit `preserveIndentation` flag (default `true`) to rebase content to the target line's indent, or `false` to apply content verbatim.
### Main Editing Tool

#### `edit_file_lines`
Make line-based edits to a file using string or regex pattern matching. Each edit can:
- Replace entire lines
- Replace specific text matches while preserving line formatting
- Use regex patterns for complex matches
- Handle multiple lines and multiple edits
- Preview changes with dry run mode

Example file (`src/components/App.tsx`):
```typescript
// Basic component with props
const Button = ({ color = "blue", size = "md" }) => {
  return <button className={`btn-${color} size-${size}`}>Click me</button>;
};

// Component with multiple props and nested structure
export const Card = ({
  title,
  subtitle = "Default subtitle",
  theme = "light",
  size = "lg",
}) => {
  const cardClass = `card-${theme} size-${size}`;
  
  return (
    <div className={cardClass}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
};

// Constants and configurations
const THEME = {
  light: { bg: "#ffffff", text: "#000000" },
  dark: { bg: "#000000", text: "#ffffff" },
};

const CONFIG = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
  retries: 3,
};
```

### Example Use Cases

1. Simple String Replacement
```json
{
  "p": "src/components/App.tsx",
  "e": [{
    "startLine": 2,
    "endLine": 2,
    "content": "primary",
    "strMatch": "blue"
  }],
  "dryRun": true
}
```

Output:
```diff
Index: src/components/App.tsx
===================================================================
--- src/components/App.tsx        original
+++ src/components/App.tsx        modified
@@ -1,6 +1,6 @@
 // Basic component with props
-const Button = ({ color = "blue", size = "md" }) => {
+const Button = ({ color = "primary", size = "md" }) => {
   return Click me;
 };
 
 // Component with multiple props and nested structure
 ```

State ID: fcbf740a
Use this ID with approve_edit to apply the changes.


2. Multi-line Content with Preserved Structure  
```json
{
  "p": "src/components/App.tsx",
  "e": [{
    "startLine": 16,
    "endLine": 19,
    "content": "    <div className={cardClass}>\n      <h2 className=\"title\">{title}</h2>\n      <p className=\"subtitle\">{subtitle}</p>\n    </div>",
    "regexMatch": "<div[^>]*>[\\s\\S]*?</div>"
  }],
  "dryRun": true
}
```

Output:
```diff
Index: src/components/App.tsx
===================================================================
--- src/components/App.tsx        original
+++ src/components/App.tsx        modified
@@ -13,10 +13,10 @@
   const cardClass = `card-${theme} size-${size}`;
   
   return (
     <div className={cardClass}>
-      <h2>{title}</h2>
-      <p>{subtitle}</p>
+      <h2 className="title">{title}</h2>
+      <p className="subtitle">{subtitle}</p>
     </div>
   );
 };
```
State ID: f2ce973f
Use this ID with approve_edit to apply the changes.


3. Complex JSX Structure Modification
```json
{
  "p": "src/components/App.tsx",
  "e": [{
    "startLine": 7,
    "endLine": 12,
    "content": "export const Card = ({\n  title,\n  subtitle = \"New default\",\n  theme = \"modern\",\n  size = \"responsive\"\n}) => {",
    "regexMatch": "export const Card[\\s\\S]*?\\) => \\{"
  }],
  "dryRun": true
}
```

Output:
```diff
Index: src/components/App.tsx
===================================================================
--- src/components/App.tsx        original
+++ src/components/App.tsx        modified
@@ -5,11 +5,11 @@
 // Component with multiple props and nested structure
 export const Card = ({
   title,
-  subtitle = "Default subtitle",
-  theme = "light",
-  size = "lg",
+  subtitle = "New default",
+  theme = "modern",
+  size = "responsive"
 }) => {
   const cardClass = `card-${theme} size-${size}`;
   
   return (
```   
State ID: f1f1d27b
Use this ID with approve_edit to apply the changes.


4. Configuration Update with Whitespace Preservation
```json
{
  "p": "src/components/App.tsx",
  "e": [{
    "startLine": 29,
    "endLine": 32,
    "content": "const CONFIG = {\n  baseUrl: \"https://api.newexample.com\",\n  timeout: 10000,\n  maxRetries: 5",
    "regexMatch": "const CONFIG[\\s\\S]*?retries: \\d+"
  }],
  "dryRun": true
}
```

Output:
```diff
Index: src/components/App.tsx
===================================================================
--- src/components/App.tsx        original
+++ src/components/App.tsx        modified
@@ -26,8 +26,8 @@
   dark: { bg: "#000000", text: "#ffffff" },
 };
 
 const CONFIG = {
-  apiUrl: "https://api.example.com",
-  timeout: 5000,
-  retries: 3,
+  baseUrl: "https://api.newexample.com",
+  timeout: 10000,
+  maxRetries: 5
 };
```
State ID: 20e93c34
Use this ID with approve_edit to apply the changes.

5. Flexible Whitespace Matching
```json
{
  "p": "src/components/App.tsx",
  "e": [{
    "startLine": 9,
    "endLine": 9,
    "content": "description",
    "strMatch": "subtitle   =   \"Default subtitle\""  // Extra spaces are handled
  }],
  "dryRun": true
}
```

Output:
```diff
Index: src/components/App.tsx
===================================================================
--- src/components/App.tsx        original
+++ src/components/App.tsx        modified
@@ -5,9 +5,9 @@
 // Component with multiple props and nested structure
 export const Card = ({
   title,
-  subtitle = "Default subtitle",
+  description
   theme = "light",
   size = "lg",
 }) => {
   const cardClass = `card-${theme} size-${size}`;
```

### Insert New Lines

#### `add_file_lines`
Insert new line(s) after a given line number without removing anything. This is a pure insert operation - the preview will show only `ADD` and `KEEP` lines, never `REMOVE`.

Arguments:
```typescript
{
  p: string;         // Absolute file path
  afterLine: number; // Line number to insert after (0 = start of file, before line 1)
  content: string;   // New line(s) to insert, multi-line allowed
  dryRun?: boolean;  // Preview without writing (default false)
}
```

Example - insert after line 2:
```json
{
  "p": "src/components/App.tsx",
  "afterLine": 2,
  "content": "// Helper comment added below Button",
  "dryRun": true
}
```

Output:
```
Result: 1 line added, 0 lines removed
Line map:
KEEP 1: // Basic component with props
KEEP 2: const Button = ({ color = "blue", size = "md" }) => {
ADD 3: // Helper comment added below Button
KEEP 3:   return <button className={`btn-${color} size-${size}`}>Click me</button>;
...
```

### Delete Lines

#### `remove_file_lines`
Delete a range of lines (startLine through endLine, inclusive). This is a pure remove operation - the preview will show only `REMOVE` and `KEEP` lines, never `ADD`.

Arguments:
```typescript
{
  p: string;         // Absolute file path
  startLine: number; // First line to delete (1-indexed)
  endLine: number;   // Last line to delete (inclusive, 1-indexed)
  dryRun?: boolean;  // Preview without writing (default false)
}
```

Example - delete lines 5 through 7 of a 200-line file:
```json
{
  "p": "src/components/App.tsx",
  "startLine": 5,
  "endLine": 7,
  "dryRun": true
}
```

Output (lines 5-7 removed; file shrinks to 197 lines):
```
Result: 0 lines added, 3 lines removed
Line map:
KEEP 1: // First line
KEEP 2: // Second line
KEEP 3: // Third line
KEEP 4: // Fourth line
REMOVE 5: // Fifth line removed
REMOVE 6: // Sixth line removed
REMOVE 7: // Seventh line removed
KEEP 8: // Eighth line
... (up to line 200; original lines 8-200 become lines 5-197)
```
### Additional Tools

#### `approve_edit`
Apply changes from a previous dry run of `edit_file_lines`, `add_file_lines`, or `remove_file_lines`. This tool provides a two-step editing process for safety.

1. First, make a dry run edit:
```json 
{
  "p": "src/components/App.tsx",
  "e": [{
    "startLine": 2,
    "endLine": 2,
    "content": "primary",
    "strMatch": "blue"
  }],
  "dryRun": true
}
```

Output:
```diff
Index: src/components/App.tsx
===================================================================
--- src/components/App.tsx        original
+++ src/components/App.tsx        modified
@@ -1,6 +1,6 @@
 // Basic component with props
-const Button = ({ color = "blue", size = "md" }) => {
+const Button = ({ color = "primary", size = "md" }) => {
   return <button className={`btn-${color} size-${size}`}>Click me</button>;
 };
 ```

State ID: fcbf740a
Use this ID with approve_edit to apply the changes.


2. Then, approve the changes using the state ID:
```json
{
  "stateId": "fcbf740a"
}
```

Output:
```diff
Index: src/components/App.tsx
===================================================================
--- src/components/App.tsx        original
+++ src/components/App.tsx        modified
@@ -1,6 +1,6 @@
 // Basic component with props
-const Button = ({ color = "blue", size = "md" }) => {
+const Button = ({ color = "primary", size = "md" }) => {
   return <button className={`btn-${color} size-${size}`}>Click me</button>;
 };
```

3. Verify the changes:
```json
{
  "path": "src/components/App.tsx",
  "lineNumbers": [2],
  "context": 1
}
```

Output:
```
Line 2:
  1: // Basic component with props
> 2: const Button = ({ color = "primary", size = "md" }) => {
  3:   return <button className={`btn-${color} size-${size}`}>Click me</button>;
```

Note that state IDs expire after a short time for security. Attempting to use an expired or invalid state ID will result in an error:
```json
{
  "stateId": "invalid123"
}
```

Output:
```
Error: Invalid or expired state ID
```

#### `get_file_lines`
Inspect specific lines in a file with optional context lines. This tool is useful for verifying line content before making edits.
**`verboseWhitespace` option:** Set `"verboseWhitespace": true` to render TAB as `\t` and SPACE as `\s`, making exact whitespace visible so you can reproduce indentation verbatim:

```json
{
  "path": "src/components/App.tsx",
  "lineNumbers": [2],
  "context": 1,
  "verboseWhitespace": true
}
```

Output:
```
Line 2:
  1: // Basic component with props
> 2:   return <button className={`btn-${color} size-${size}`}>Click me</button>;

Whitespace rendering (TAB -> \t, SPACE -> \s; other chars -> U+XXXX):
> 2: \s\sreturn <button className={`btn-${color} size-${size}`}>Click me</button>;
```

```json
{
  "path": "src/components/App.tsx",
  "lineNumbers": [1, 2, 3],
  "context": 1
}
```

Output:
```
Line 1:
> 1: // Basic component with props
  2: const Button = ({ color = "blue", size = "md" }) => {

Line 2:
  1: // Basic component with props
> 2: const Button = ({ color = "blue", size = "md" }) => {
  3:   return Click me;

Line 3:
  2: const Button = ({ color = "blue", size = "md" }) => {
> 3:   return Click me;
  4: };
```

#### `search_file`
Search a file for text patterns or regular expressions to find specific line numbers and their surrounding context. This tool is particularly useful for locating the exact lines you want to edit with `edit_file_lines`.
**`verboseWhitespace` option:** Set `"verboseWhitespace": true` to render TAB as `\t` and SPACE as `\s` in the output, making exact whitespace visible. Useful for verifying indentation before reproducing it in edits.

Features:
- Simple text search with optional case sensitivity
- Regular expression support
- Whole word matching
- Configurable context lines
- Returns line numbers, content, and surrounding context with line numbers

Arguments:
```typescript
{
  path: string;          // Path to the file to search
  pattern: string;       // Search pattern (text or regex)
  type?: "text" | "regex"; // Type of search (default: "text")
  caseSensitive?: boolean; // Case-sensitive search (default: false)
  contextLines?: number;   // Number of context lines (default: 2, max: 10)
  maxMatches?: number;     // Maximum matches to return (default: 100)
  wholeWord?: boolean;     // Match whole words only (default: false)
  multiline?: boolean;     // Enable multiline regex mode (default: false)
}
```

Example use cases:

1. Simple text search:
```json
{
  "path": "src/components/App.tsx",
  "pattern": "const",
  "contextLines": 2
}
```

Output:
```
Found 6 matches in 0.9ms:
File size: 0.7KB

Match 1: Line 2, Column 1
----------------------------------------
     1 | // Basic component with props
>    2 | const Button = ({ color = "blue", size = "md" }) => {
     3 |   return <button className={`btn-${color} size-${size}`}>Click me</button>;
     4 | };

Match 2: Line 7, Column 8
----------------------------------------
     5 | 
     6 | // Component with multiple props and nested structure
>    7 | export const Card = ({
     8 |   title,
     9 |   subtitle = "Default subtitle",

Match 3: Line 13, Column 3
----------------------------------------
    11 |   size = "lg",
    12 | }) => {
>   13 |   const cardClass = `card-${theme} size-${size}`;
    14 |   
    15 |   return (

Match 4: Line 23, Column 4
----------------------------------------
    21 | };
    22 | 
>   23 | // Constants and configurations
    24 | const THEME = {
    25 |   light: { bg: "#ffffff", text: "#000000" },

Match 5: Line 24, Column 1
----------------------------------------
    22 | 
    23 | // Constants and configurations
>   24 | const THEME = {
    25 |   light: { bg: "#ffffff", text: "#000000" },
    26 |   dark: { bg: "#000000", text: "#ffffff" },

Match 6: Line 29, Column 1
----------------------------------------
    27 | };
    28 | 
>   29 | const CONFIG = {
    30 |   apiUrl: "https://api.example.com",
    31 |   timeout: 5000,
```

2. Case-sensitive whole word search:
```json
{
  "path": "src/components/App.tsx",
  "pattern": "props",
  "caseSensitive": true,
  "wholeWord": true,
  "contextLines": 1
}
```

Output:
```
Found 2 matches in 0.7ms:
File size: 0.7KB

Match 1: Line 1, Column 25
----------------------------------------
>    1 | // Basic component with props
     2 | const Button = ({ color = "blue", size = "md" }) => {

Match 2: Line 6, Column 28
----------------------------------------
     5 | 
>    6 | // Component with multiple props and nested structure
     7 | export const Card = ({
```

3. Finding JSX components:
```json
{
  "path": "src/components/App.tsx",
  "pattern": "<[A-Z]\\w+\\s",
  "type": "regex",
  "contextLines": 1
}
```

Output:
```
Found 2 matches in 0.6ms:
File size: 0.7KB

Match 1: Line 3, Column 10
----------------------------------------
     2 | const Button = ({ color = "blue", size = "md" }) => {
>    3 |   return <button className={`btn-${color} size-${size}`}>Click me</button>;
     4 | };

Match 2: Line 16, Column 5
----------------------------------------
    15 |   return (
>   16 |     <div className={cardClass}>
    17 |       <h2>{title}</h2>
```

Common workflows:

1. Find then edit:
```typescript
// First, search for the line
{
  "path": "src/config.ts",
  "pattern": "API_URL",
  "wholeWord": true
}

// Then use the returned line number in edit_file_lines
{
  "p": "src/config.ts",
  "e": [{
    "startLine": 23,  // Line number from search result
    "endLine": 23,
    "content": "export const API_URL = 'https://new-api.example.com';"
  }]
}
```

2. Find all usages:
```typescript
{
  "path": "src/components/App.tsx",
  "pattern": "\\buseMemo\\b",
  "type": "regex",
  "contextLines": 2,
  "maxMatches": 50
}
```

3. Find specific prop patterns:
```typescript
{
  "path": "src/components/App.tsx",
  "pattern": "className=['\"]([^'\"]+)['\"]",
  "type": "regex",
  "contextLines": 1
}
```

### Important Notes

1. Whitespace Handling
   - The tool intelligently handles whitespace in both string and regex matches
   - Original indentation is preserved in replacements
   - Multiple spaces between tokens are normalized for matching

2. Pattern Matching
   - String matches (`strMatch`) are whitespace-normalized
   - Regex patterns (`regexMatch`) support look-ahead and look-behind
   - Cannot use both `strMatch` and `regexMatch` in the same edit
   - Overlapping regex patterns are detected and prevented

3. Best Practices
   - Always use dry run first to verify changes
   - Review the diff output before approving changes
   - Keep edit operations focused and atomic
   - Use appropriate pattern matching for your use case
4. Verbose Whitespace
   - `get_file_lines` and `search_file` support `"verboseWhitespace": true` to render TAB as `\t` and SPACE as `\s`, making whitespace visible. Non-whitespace characters outside printable ASCII render as `U+XXXX`.
   - Use `get_file_lines` with `verboseWhitespace: true` to see exact indentation, then `edit_file_lines` with `preserveIndentation: false` and matching indentation to edit without altering whitespace.

5. Preserve Indentation
   - `edit_file_lines` accepts `preserveIndentation` per edit operation (default: `true`). When true, the base indent of your content is detected and re-indented to match the target line. When false, your content is applied verbatim. Set false when the rebase is wrong (e.g. file uses tabs, your content uses spaces, or vice versa).

6. Line Map Output
   - Every edit/add/remove operation outputs `Result:` with line counts and a `Line map:` showing KEEP/REMOVE/ADD per line, so deletions are always visible and countable.

7. Force Dry-Run
   - Pass `--force-dry-run` to the server startup command to reject any operation that does not set `"dryRun": true`. Useful for ensuring preview workflow compliance.


## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

### Testing

Run the test suite:
```bash
npm run test
```

Additional testing utilities:

#### Test Tools Script
Test the MCP tools directly against sample files:
```bash
npm run test:tools
```

This script:
- Resets test fixtures to a known state
- Connects to the MCP server
- Tests each tool in sequence:
  - `get_file_lines`
  - `edit_file_lines` (dry run)
  - `approve_edit`
- Shows the output of each operation
- Verifies changes were applied correctly

#### Reset Fixtures Script
Reset test fixtures to their original state:
```bash
npm run reset:fixtures
```

Use this script to:
- Reset test files to a known state before testing
- Clean up after failed tests
- Ensure consistent test environment
- Create missing fixture directories

## Usage

The server requires one or more allowed directories to be specified when starting:
```bash
node build/index.js [--force-dry-run] <allowed-directory> [additional-directories...]
```
All file operations will be restricted to these directories for security.

### Environment Variables

- `MCP_EDIT_STATE_TTL`: Time-to-live in milliseconds for edit states (default: 60000). Edit states will expire after this duration and must be recreated.

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "edit-file-lines": {
      "command": "node",
      "args": [
        "/path/to/edit-file-lines/build/index.js",
        "<allowed-directory>"
      ],
      "env": {
        "MCP_EDIT_STATE_TTL": "300000"  // Optional: Set custom TTL (in milliseconds)
      }
    }
  }
}
```

### Error Handling

The tool provides clear error messages for common issues:

1. Match Not Found
```
Error: No string match found for "oldValue" on line 5
```

2. Invalid Regex
```
Error: Invalid regex pattern "([": Unterminated group
```

3. Multiple Edits on Same Line
```
Error: Line 5 is affected by multiple edits
```

### Security Considerations

- All file operations are restricted to explicitly allowed directories
- Symlinks are validated to prevent escaping allowed directories
- Parent directory traversal is prevented
- Path normalization is performed for consistent security checks
- Invalid line numbers and character positions are rejected
- Line ending normalization ensures consistent behavior across platforms
- Edit states expire after 60 seconds for security
- Edit approvals require exact match of file path and edits

### Debugging

Use the Test Tools script to test the MCP tools directly against sample files. The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) might help, but it currently does not support handing input that are not string values.