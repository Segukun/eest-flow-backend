import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { app, request } from "./helpers.js";

describe("GET /api/health", () => {
  it("responde 200 con el status ok", async () => {
    const res = await request(app).get("/api/health");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok" });
  });

  it("no exige autenticación", async () => {
    const res = await request(app).get("/api/health");

    assert.equal(res.status, 200);
  });
});

describe("404 handler", () => {
  it("devuelve JSON, no el HTML por defecto de Express", async () => {
    const res = await request(app).get("/api/ruta-inexistente");

    assert.equal(res.status, 404);
    assert.ok(res.body.message, "esperaba un mensaje de error en JSON");
  });
});