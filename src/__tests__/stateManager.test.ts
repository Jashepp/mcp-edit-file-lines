import { EditOperation } from "../types/editTypes.js";
import { StateManager } from "../utils/stateManager.js";

describe("StateManager", () => {
  let stateManager: StateManager;

  beforeEach(() => {
    // Reset environment variable before each test
    delete process.env.MCP_EDIT_STATE_TTL;
    stateManager = new StateManager();
  });

  describe("Constructor", () => {
    it("should initialize with default TTL", () => {
      expect(stateManager.getTTL()).toBe(60 * 1000); // 1 minute
    });

    it("should use custom TTL from environment variable", () => {
      process.env.MCP_EDIT_STATE_TTL = "30000"; // 30 seconds
      const customStateManager = new StateManager();
      expect(customStateManager.getTTL()).toBe(30000);
    });

    it("should throw error for invalid TTL", () => {
      process.env.MCP_EDIT_STATE_TTL = "-1000";
      expect(() => new StateManager()).toThrow(
        "MCP_EDIT_STATE_TTL must be a positive number when set"
      );
    });

    it("should throw error for non-numeric TTL", () => {
      process.env.MCP_EDIT_STATE_TTL = "invalid";
      expect(() => new StateManager()).toThrow(
        "MCP_EDIT_STATE_TTL must be a positive number when set"
      );
    });
  });

  describe("saveState", () => {
    const samplePath = "/path/to/file.txt";
    const sampleEdit: EditOperation = {
      startLine: 1,
      endLine: 2,
      content: "new content",
      strMatch: "old content"
    };

    it("should save state and return consistent ID for same input", () => {
      const id1 = stateManager.saveState(samplePath, [sampleEdit]);
      const id2 = stateManager.saveState(samplePath, [sampleEdit]);
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]{8}$/); // 8 character hex string
    });

    it("should handle array-style edits", () => {
      const arrayStyleEdit: [number, number, string, string] = [
        1,
        2,
        "new content",
        "old content"
      ];
      const id = stateManager.saveState(samplePath, [arrayStyleEdit]);
      expect(id).toMatch(/^[a-f0-9]{8}$/);
    });

    it("should generate different IDs for different inputs", () => {
      const id1 = stateManager.saveState(samplePath, [sampleEdit]);
      const id2 = stateManager.saveState(samplePath, [
        {
          ...sampleEdit,
          content: "different content"
        }
      ]);
      expect(id1).not.toBe(id2);
    });

    it("should handle regex matches", () => {
      const regexEdit: EditOperation = {
        ...sampleEdit,
        regexMatch: "\\s*old\\s+content\\s*"
      };
      const id = stateManager.saveState(samplePath, [regexEdit]);
      expect(id).toMatch(/^[a-f0-9]{8}$/);
    });
  });

  describe("getState", () => {
    const samplePath = "/path/to/file.txt";
    const sampleEdit: EditOperation = {
      startLine: 1,
      endLine: 2,
      content: "new content"
    };

    it("should return undefined for non-existent state", () => {
      expect(stateManager.getState("nonexistent")).toBeUndefined();
    });

    it("should return state for valid ID", () => {
      const id = stateManager.saveState(samplePath, [sampleEdit]);
      const state = stateManager.getState(id);
      expect(state).toBeDefined();
      expect(state?.path).toBe(samplePath);
      expect(state?.edits).toHaveLength(1);
      expect(state?.edits?.[0]).toEqual(sampleEdit);
    });

    it("should handle expired states", async () => {
      // Create state manager with 100ms TTL
      process.env.MCP_EDIT_STATE_TTL = "100";
      const shortTTLManager = new StateManager();

      const id = shortTTLManager.saveState(samplePath, [sampleEdit]);

      // Wait for state to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(shortTTLManager.getState(id)).toBeUndefined();
    });
  });

  describe("deleteState", () => {
    const samplePath = "/path/to/file.txt";
    const sampleEdit: EditOperation = {
      startLine: 1,
      endLine: 2,
      content: "new content"
    };

    it("should delete existing state", () => {
      const id = stateManager.saveState(samplePath, [sampleEdit]);
      expect(stateManager.getState(id)).toBeDefined();

      stateManager.deleteState(id);
      expect(stateManager.getState(id)).toBeUndefined();
    });

    it("should handle deleting non-existent state", () => {
      expect(() => stateManager.deleteState("nonexistent")).not.toThrow();
    });
  });

  describe("cleanup", () => {
    it("should automatically clean up expired states", async () => {
      process.env.MCP_EDIT_STATE_TTL = "100";
      const shortTTLManager = new StateManager();

      // Add multiple states
      shortTTLManager.saveState("/path1.txt", [
        { startLine: 1, endLine: 1, content: "content1" }
      ]);
      shortTTLManager.saveState("/path2.txt", [
        { startLine: 1, endLine: 1, content: "content2" }
      ]);

      expect(shortTTLManager.getActiveStateCount()).toBe(2);

      // Wait for states to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Trigger cleanup by trying to get a state
      shortTTLManager.getState("any-id");

      expect(shortTTLManager.getActiveStateCount()).toBe(0);
    });
  });

  describe("saveAddState and saveRemoveState", () => {
    it("should save add state and retrieve it", () => {
      const stateId = stateManager.saveAddState("/path/to/file.txt", 1, "new line");
      expect(stateId).toMatch(/^[a-f0-9]{8}$/);
      const state = stateManager.getState(stateId);
      expect(state).toBeDefined();
      expect(state?.kind).toBe("add");
      expect(state?.path).toBe("/path/to/file.txt");
      expect(state?.afterLine).toBe(1);
      expect(state?.content).toBe("new line");
    });

    it("should save remove state and retrieve it", () => {
      const stateId = stateManager.saveRemoveState("/path/to/file.txt", 2, 4);
      expect(stateId).toMatch(/^[a-f0-9]{8}$/);
      const state = stateManager.getState(stateId);
      expect(state).toBeDefined();
      expect(state?.kind).toBe("remove");
      expect(state?.path).toBe("/path/to/file.txt");
      expect(state?.startLine).toBe(2);
      expect(state?.endLine).toBe(4);
    });

    it("add and edit on same file should produce distinct IDs", () => {
      const editId = stateManager.saveState("/path/to/file.txt", [
        { startLine: 1, endLine: 1, content: "line 1" }
      ]);
      const addId = stateManager.saveAddState("/path/to/file.txt", 0, "line 1");
      expect(editId).not.toBe(addId);
    });

    it("remove and edit on same file should produce distinct IDs", () => {
      const editId = stateManager.saveState("/path/to/file.txt", [
        { startLine: 1, endLine: 1, content: "line 1" }
      ]);
      const removeId = stateManager.saveRemoveState("/path/to/file.txt", 1, 1);
      expect(editId).not.toBe(removeId);
    });

    it("remove and add on same file should produce distinct IDs", () => {
      const addId = stateManager.saveAddState("/path/to/file.txt", 0, "line 1");
      const removeId = stateManager.saveRemoveState("/path/to/file.txt", 1, 1);
      expect(addId).not.toBe(removeId);
    });
  });
});
