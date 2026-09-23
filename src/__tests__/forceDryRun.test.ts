import { initForceDryRun, forceDryRun, checkForceDryRun } from "../utils/forceDryRun.js";

describe("forceDryRun", () => {
  // Test initForceDryRun
  it("should set forceDryRun true when --force-dry-run is passed", () => {
    initForceDryRun(["node", "build/index.js", "--force-dry-run", "/path/to/file"]);
    expect(forceDryRun).toBe(true);
  });

  it("should set forceDryRun true when --forceDryRun (camelCase) is passed", () => {
    initForceDryRun(["node", "build/index.js", "--forceDryRun", "/path/to/file"]);
    expect(forceDryRun).toBe(true);
  });

  it("should keep forceDryRun false when flag is not passed", () => {
    initForceDryRun(["node", "build/index.js", "/path/to/file"]);
    expect(forceDryRun).toBe(false);
  });

  // Test checkForceDryRun
  it("should return error object when forceDryRun is true and dryRun is false", () => {
    initForceDryRun(["node", "build/index.js", "--force-dry-run", "/path/to/file"]);
    const error = checkForceDryRun(false);
    expect(error).not.toBeNull();
    expect(error!.type).toBe("text");
    expect(error!.text).toContain("--force-dry-run is enabled");
  });

  it("should return null when forceDryRun is true and dryRun is true", () => {
    initForceDryRun(["node", "build/index.js", "--force-dry-run", "/path/to/file"]);
    const error = checkForceDryRun(true);
    expect(error).toBeNull();
  });

  it("should return null when forceDryRun is false and dryRun is false", () => {
    initForceDryRun(["node", "build/index.js", "/path/to/file"]);
    const error = checkForceDryRun(false);
    expect(error).toBeNull();
  });
});
