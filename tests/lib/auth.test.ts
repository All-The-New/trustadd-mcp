import { describe, it, expect, afterEach } from "vitest";
import { readApiKey } from "../../src/lib/auth.js";

describe("readApiKey", () => {
  afterEach(() => {
    delete process.env.TRUSTADD_API_KEY;
  });

  it("returns undefined when unset", () => {
    expect(readApiKey()).toBeUndefined();
  });

  it("returns undefined when blank", () => {
    process.env.TRUSTADD_API_KEY = "";
    expect(readApiKey()).toBeUndefined();
  });

  it("returns undefined when whitespace only", () => {
    process.env.TRUSTADD_API_KEY = "   \t  ";
    expect(readApiKey()).toBeUndefined();
  });

  it("trims and returns a real key", () => {
    process.env.TRUSTADD_API_KEY = "  abc_test_token  ";
    expect(readApiKey()).toBe("abc_test_token");
  });
});
