import { describe, expect, it } from "vitest";
import { validEmail, normalizeEmail, validIdentifier, validateAuth } from "./auth-validation";

describe("account validation", () => {
  it("accepts normal, numeric, tagged and international-domain email addresses", () => {
    for (const value of ["123456@mail.ru", "user.name+tag@example.com", "user@пример.рф", "u@xn--e1afmkfd.xn--p1ai"]) expect(validEmail(value), value).toBe(true);
    expect(normalizeEmail(" User+tag@ПРИМЕР.РФ ")).toBe("User+tag@xn--e1afmkfd.xn--p1ai");
  });
  it("rejects malformed addresses and numeric top level domains", () => {
    for (const value of ["a..b@mail.ru", "user@@mail.ru", "user@example.123", "user@1.1.1.1", "a@-mail.ru", "a@mail-.ru", "a@mail..ru", "a@x.c", "a@x/evil.ru"]) expect(validEmail(value), value).toBe(false);
  });
  it("accepts logins compatible with the current schema and rejects symbol-only names", () => {
    for (const value of ["Ivan_42", "User-2", "123456"]) expect(validIdentifier(value), value).toBe(true);
    for (const value of ["--", "---", ".....", "Иван_42", "ab", "user.name", "user name"]) expect(validIdentifier(value), value).toBe(false);
  });
  it("validates registration fields", () => {
    expect(validateAuth("register", { email: "wrong", displayName: "bad name", password: "short" })).toMatchObject({ email: expect.any(String), displayName: expect.any(String), password: expect.any(String) });
    expect(validateAuth("register", { email: "ok@example.com", displayName: "Ivan_42", password: "12345678" })).toEqual({});
  });
});
