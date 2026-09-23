// utils/approveEdit.ts
import {
  editFile,
  formatEditOutput,
  insertFileLines,
  deleteFileLines
} from "./fileEditor.js";
import { StateManager } from "./stateManager.js";

export async function approveEdit(
  stateId: string,
  stateManager: StateManager
): Promise<string> {
  const savedState = stateManager.getState(stateId);
  if (!savedState) {
    throw new Error("Invalid or expired state ID");
  }

  try {
    let diff: string;
    let lineMap: { lines: string[]; added: number; removed: number };

    switch (savedState.kind) {
      case "edit": {
        const result = await editFile(savedState.path, savedState.edits!, false);
        diff = result.diff;
        lineMap = result.lineMap;
        break;
      }
      case "add": {
        const result = await insertFileLines(
          savedState.path,
          savedState.afterLine!,
          savedState.content!,
          false
        );
        diff = result.diff;
        lineMap = result.lineMap;
        break;
      }
      case "remove": {
        const result = await deleteFileLines(
          savedState.path,
          savedState.startLine!,
          savedState.endLine!,
          false
        );
        diff = result.diff;
        lineMap = result.lineMap;
        break;
      }
    }

    // Only delete the state if the operation was successful
    stateManager.deleteState(stateId);

    return formatEditOutput(diff, lineMap);
  } catch (error) {
    // If anything fails, preserve the state and re-throw
    throw error;
  }
}

/**
 * Verify if an edit state exists and is valid
 */
export function verifyEditState(
  stateId: string,
  stateManager: StateManager
): boolean {
  return stateManager.isStateValid(stateId);
}
