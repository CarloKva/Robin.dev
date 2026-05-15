import { describe, it, expect } from "vitest";
import { setupRepoForRead } from "../services/repo-setup";

describe("setupRepoForRead branch safety", () => {
  it("rejects shell-injection attempts in defaultBranch", async () => {
    await expect(
      setupRepoForRead({
        repositoryId: "test-repo",
        repoUrl: "https://github.com/test/test.git",
        defaultBranch: "main; rm -rf /",
      })
    ).rejects.toThrow(/unsafe branch name/);
  });

  it("rejects defaultBranch starting with a dash (option-like)", async () => {
    await expect(
      setupRepoForRead({
        repositoryId: "test-repo",
        repoUrl: "https://github.com/test/test.git",
        defaultBranch: "--upload-pack=evil",
      })
    ).rejects.toThrow(/unsafe branch name/);
  });

  it("rejects defaultBranch with spaces", async () => {
    await expect(
      setupRepoForRead({
        repositoryId: "test-repo",
        repoUrl: "https://github.com/test/test.git",
        defaultBranch: "main\n--exec evil",
      })
    ).rejects.toThrow(/unsafe branch name/);
  });

  it("rejects empty defaultBranch", async () => {
    await expect(
      setupRepoForRead({
        repositoryId: "test-repo",
        repoUrl: "https://github.com/test/test.git",
        defaultBranch: "",
      })
    ).rejects.toThrow(/unsafe branch name/);
  });

  // We deliberately do NOT test the happy path here — that would clone a real
  // repository and run git on disk. The branch-name guard is the security
  // surface; integration tests against a real workspace cover the rest.
});
