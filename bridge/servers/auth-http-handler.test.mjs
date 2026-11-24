import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import authHandlerModule from "./auth-http-handler.cjs";
const { createAuthHttpHandler } = authHandlerModule;

describe("auth API before storage and email are connected", () => {
  it("validates input on the server and reports services unavailable without pretending success", async () => {
    const server = createServer(createAuthHttpHandler());
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    const post = (path, body) => fetch(`${base}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    try {
      const invalid = await post("register", { email: "bad", displayName: "x", password: "short" });
      expect(invalid.status).toBe(400);
      expect(await invalid.json()).toMatchObject({ code: "invalid_input", errors: { email: expect.any(String), displayName: expect.any(String), password: expect.any(String) } });
      const valid = { email: "test@example.com", displayName: "Robot_operator", password: "a long passphrase" };
      expect((await post("register", valid)).status).toBe(503);
      expect((await post("login", { identifier: valid.email, password: valid.password })).status).toBe(503);
      expect((await post("login", { identifier: "Иван_42", password: "password" })).status).toBe(503);
      expect((await post("login", { identifier: "bad name", password: "password" })).status).toBe(400);
      expect((await post("forgot-password", { email: valid.email })).status).toBe(503);
      expect((await post("reset-password", { token: "bad", password: valid.password })).status).toBe(400);
      expect((await post("reset-password", { token: "x".repeat(43), password: valid.password })).status).toBe(503);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
