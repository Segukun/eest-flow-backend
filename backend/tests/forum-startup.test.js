import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Post from "../src/models/post.model.js";
import {
  deleteStorageFiles,
  uploadPostFiles,
} from "../src/services/storage.service.js";
import {
  adminClient,
  app,
  createPost,
  request,
  resetDatabase,
  userClient,
} from "./helpers.js";

const storageKeys = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_STORAGE_BUCKET",
];

// Configuración ficticia, usada sin solicitudes a Supabase.
const testStorage = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SECRET_KEY: "storage-test-only-key",
  SUPABASE_STORAGE_BUCKET: "test-bucket",
};

function setStorageConfig(t, values) {
  const previous = Object.fromEntries(
    storageKeys.map((key) => [key, process.env[key]]),
  );

  for (const key of storageKeys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }

  t.after(() => {
    for (const key of storageKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

describe("Montaje del foro sin Supabase", () => {
  beforeEach(resetDatabase);

  it("post.routes.js carga con el middleware authorize existente", async () => {
    assert.ok(storageKeys.every((key) => !process.env[key]));
    const { default: routes } = await import("../src/routes/post.routes.js");
    assert.equal(typeof routes, "function");
  });

  const protectedRoutes = [
    ["get", "/api/posts"],
    ["get", "/api/posts/507f1f77bcf86cd799439011"],
    ["get", "/api/posts/507f1f77bcf86cd799439011/comments"],
    ["post", "/api/posts/507f1f77bcf86cd799439011/comments"],
    ["post", "/api/posts/507f1f77bcf86cd799439011/like"],
    ["delete", "/api/posts/507f1f77bcf86cd799439011/like"],
    ["patch", "/api/posts/507f1f77bcf86cd799439011/pin"],
    ["get", "/api/notifications"],
  ];

  for (const [method, url] of protectedRoutes) {
    it(`${method.toUpperCase()} ${url}: sin cookie responde 401, no 404`, async () => {
      const res = await request(app)[method](url);
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Authentication required" });
    });
  }

  it("lee posts y metadata de adjuntos desde MongoDB sin inicializar storage", async () => {
    const { user, client } = await userClient();
    const post = await createPost({
      author: user._id,
      sector: user.sectors[0],
      attachments: [{
        type: "file",
        url: "https://example.test/documento.pdf",
        path: "posts/test/documento.pdf",
        originalName: "documento.pdf",
        mimeType: "application/pdf",
        size: 12,
      }],
    });

    const listed = await client.get("/api/posts?page=1&limit=10");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.pagination.total, 1);
    assert.equal(listed.body.data.posts[0]._id, String(post._id));

    const detail = await client.get(`/api/posts/${post._id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.attachments[0].url, post.attachments[0].url);
    assert.equal(detail.body.data.author._id, String(user._id));
    assert.equal(detail.body.data.sector._id, String(user.sectors[0]));
    assert.equal(detail.body.data.isLiked, false);
  });

  it("un collaborator sigue sin poder fijar publicaciones", async () => {
    const { user, client } = await userClient();
    const post = await createPost({ author: user._id, sector: user.sectors[0] });
    const res = await client.patch(`/api/posts/${post._id}/pin`).send({ pinned: true });

    assert.equal(res.status, 403);
    assert.equal((await Post.findById(post._id)).pinned, false);
  });

  it("un admin conserva el permiso para fijar publicaciones", async () => {
    const { user } = await userClient();
    const post = await createPost({ author: user._id, sector: user.sectors[0] });
    const { client } = await adminClient();
    const res = await client.patch(`/api/posts/${post._id}/pin`).send({ pinned: true });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.pinned, true);
  });
});

describe("Storage validado al utilizarse", () => {
  it("sin archivos ni rutas para borrar no exige configuración", async (t) => {
    setStorageConfig(t, {});
    assert.deepEqual(await uploadPostFiles("test", []), []);
    assert.equal(await deleteStorageFiles([]), undefined);
  });

  for (const missing of storageKeys) {
    it(`si falta ${missing}, subir o borrar devuelve un error controlado`, async (t) => {
      setStorageConfig(t, { ...testStorage, [missing]: undefined });
      const logger = t.mock.method(console, "error", () => {});
      const file = {
        originalname: "prueba.png",
        mimetype: "image/png",
        buffer: Buffer.from("test"),
        size: 4,
      };
      const isConfigurationError = (error) =>
        error.statusCode === 503 && error.message === "Storage is not configured";

      await assert.rejects(uploadPostFiles("test", [file]), isConfigurationError);
      await assert.rejects(deleteStorageFiles(["posts/test/prueba.png"]), isConfigurationError);
      assert.ok(logger.mock.calls.some(({ arguments: args }) =>
        args.join(" ").includes(missing)));
    });
  }

  it("una subida sin configuración responde JSON controlado sin filtrar detalles", async (t) => {
    setStorageConfig(t, {});
    t.mock.method(console, "error", () => {});
    const { client } = await userClient();
    const res = await client.post("/api/posts")
      .field("content", JSON.stringify([{ type: "paragraph", text: "con archivo" }]))
      .attach("files", Buffer.from("test"), { filename: "prueba.png", contentType: "image/png" });

    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { message: "Internal server error" });
    assert.equal(await Post.countDocuments({}), 0);
  });

  it("permite cargar variables después del import y reutiliza el cliente sin red", async (t) => {
    setStorageConfig(t, {});
    t.mock.method(console, "error", () => {});
    const fetchMock = t.mock.method(globalThis, "fetch", async () => {
      throw new Error("Unexpected network request");
    });
    const { getSupabase } = await import("../src/config/supabase.js?late-env-test");

    assert.throws(getSupabase, (error) => error.statusCode === 503);
    Object.assign(process.env, testStorage);

    const client = getSupabase();
    assert.ok(client.storage);
    assert.equal(getSupabase(), client);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("configuración inválida no filtra el error del SDK", async (t) => {
    setStorageConfig(t, { ...testStorage, SUPABASE_URL: "invalid-url" });
    const logger = t.mock.method(console, "error", () => {});
    const { getSupabase } = await import("../src/config/supabase.js?invalid-env-test");

    assert.throws(getSupabase, (error) =>
      error.statusCode === 503 && error.message === "Storage configuration is invalid");
    assert.deepEqual(logger.mock.calls[0].arguments, [
      "[storage] Supabase configuration is invalid",
    ]);
  });
});
