// Module-level flag for --force-dry-run CLI mode
export let forceDryRun: boolean = false;

/**
 * Initialize the forceDryRun flag by parsing CLI arguments.
 * Looks for --force-dry-run or --forceDryRun (case-insensitive).
 */
export function initForceDryRun(argv: string[] = process.argv): void {
  forceDryRun = argv.some((arg) =>
    arg.toLowerCase() === "--force-dry-run" || arg.toLowerCase() === "--forcedryrun"
  );
}

/**
 * Check if force-dry-run mode is active and the tool was called without dryRun.
 * Returns an error content object if the check fails, or null otherwise.
 */
export function checkForceDryRun(dryRun: boolean) {
  if (forceDryRun && !dryRun) {
    return { type: "text", text: "Error: --force-dry-run is enabled. Run with dryRun=true first to preview the edit, then use approve_edit to apply it." };
  }
  return null;
}
