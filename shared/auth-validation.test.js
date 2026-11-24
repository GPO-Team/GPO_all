import { describe, expect, it } from "vitest";
import { validEmail, validIdentifier, validateAuth } from "./auth-validation";

describe("account validation", () => {
  it("accepts an email or a login while rejecting malformed identifiers", () => {
    for (const value of ["ivan@example.com", "Иван_42", "User-2"]) expect(validIdentifier(value)).toBe(true);
    for (const value of ["user@broken", "ivan name", "a", "@", "user@@x.ru"]) expect(validIdentifier(value)).toBe(false);
    expect(validEmail("ivan@example.com")).toBe(true);
  });
  it("validates registration including short password and login format", () => {
    expect(validateAuth("register", { email: "wrong", displayName: "bad name", password: "short" })).toMatchObject({ email: expect.any(String), displayName: expect.any(String), password: expect.any(String) });
    expect(validateAuth("register", { email: "ok@example.com", displayName: "Иван_42", password: "12345678" })).toEqual({});
  });
});
