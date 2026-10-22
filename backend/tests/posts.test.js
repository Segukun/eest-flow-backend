import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Notification from "../src/models/notification.model.js";
import Post from "../src/models/post.model.js";
import {
  adminClient,
  app,
  createPost,
  createSector,
  createUser,
  loginAs,
  request,
  resetDatabase,
  userClient,
} from "./helpers.js";

beforeEach(resetDatabase);

const paragraph = (text) => [{ type: "paragraph", text }];

describe("POST /api/posts", () => {
  it("exige autenticación", async () => {
    const res = await request(app)
      .post("/api/posts")
      .send({ content: paragraph("hola") });

    assert.equal(res.status, 401);
  });

  it("un collaborator crea un post de texto y persiste", async () => {
    const { client } = await userClient();

    const res = await client
      .post("/api/posts")
      .send({ content: paragraph("primer post") });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.content[0].text, "primer post");
    assert.equal(res.body.data.likesCount, 0);
    assert.equal(res.body.data.commentsCount, 0);

    const stored = await Post.findById(res.body.data._id);
    assert.ok(stored);
    assert.equal(stored.content[0].text, "primer post");
    assert.equal(stored.active, true);
  });

  it("usa el primer sector del usuario cuando no se envía sector", async () => {
    const { user, client } = await userClient();

    const res = await client
      .post("/api/posts")
      .send({ content: paragraph("sin sector") });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.sector._id, user.sectors[0].toString());
  });

  it("rechaza un contenido vacío con 400", async () => {
    const { client } = await userClient();

    const res = await client.post("/api/posts").send({ content: [] });

    assert.equal(res.status, 400);
    assert.equal(await Post.countDocuments({}), 0);
  });

  it("rechaza un sector al que el usuario no pertenece con 403", async () => {
    const { client } = await userClient();
    const otroSector = await createSector();

    const res = await client
      .post("/api/posts")
      .send({ content: paragraph("ajeno"), sector: otroSector._id.toString() });

    assert.equal(res.status, 403);
    assert.equal(await Post.countDocuments({}), 0);
  });
});

describe("GET /api/posts", () => {
  it("exige autenticación", async () => {
    const res = await request(app).get("/api/posts");

    assert.equal(res.status, 401);
  });

  it("lista solo los posts activos", async () => {
    const { client } = await userClient();
    await client.post("/api/posts").send({ content: paragraph("visible") });

    const res = await client.get("/api/posts");

    assert.equal(res.status, 200);
    assert.equal(res.body.data.posts.length, 1);
    assert.equal(res.body.data.posts[0].content[0].text, "visible");
    assert.equal(res.body.data.posts[0].isLiked, false);
    assert.equal(res.body.data.pagination.total, 1);
  });

  it("marca isLiked cuando el usuario ya dio like", async () => {
    const autor = await userClient();
    const creado = await autor.client
      .post("/api/posts")
      .send({ content: paragraph("con like") });

    const { client } = await userClient();
    await client.post(`/api/posts/${creado.body.data._id}/like`);

    const res = await client.get("/api/posts");

    assert.equal(res.status, 200);
    assert.equal(res.body.data.posts[0].isLiked, true);
  });

  it("no incluye posts desactivados", async () => {
    const { client } = await userClient();
    const sector = (await createSector())._id;
    const desactivado = await createPost({
      author: (await createUser({ sectors: [sector] }))._id,
      sector,
      active: false,
    });

    const res = await client.get("/api/posts");

    assert.equal(res.status, 200);
    assert.ok(!res.body.data.posts.some((p) => p._id === desactivado._id.toString()));
  });
});

describe("GET /api/posts/:id", () => {
  it("devuelve el post puntual", async () => {
    const { client } = await userClient();
    const creado = await client
      .post("/api/posts")
      .send({ content: paragraph("puntual") });

    const res = await client.get(`/api/posts/${creado.body.data._id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.content[0].text, "puntual");
  });

  it("devuelve 404 para un post inexistente", async () => {
    const { client } = await userClient();

    const res = await client.get("/api/posts/507f1f77bcf86cd799439011");

    assert.equal(res.status, 404);
  });

  it("devuelve 400 para un id mal formado", async () => {
    const { client } = await userClient();

    const res = await client.get("/api/posts/no-es-un-objectid");

    assert.equal(res.status, 400);
  });
});

describe("PUT /api/posts/:id", () => {
  it("el autor actualiza el contenido y persiste", async () => {
    const { client } = await userClient();
    const creado = await client
      .post("/api/posts")
      .send({ content: paragraph("antes") });

    const res = await client
      .put(`/api/posts/${creado.body.data._id}`)
      .send({ content: paragraph("despues") });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.content[0].text, "despues");

    const stored = await Post.findById(creado.body.data._id);
    assert.equal(stored.content[0].text, "despues");
  });

  it("ignora cualquier `attachments` enviado (el contenido es la única edición)", async () => {
    const { user, client } = await userClient();
    const post = await createPost({
      author: user._id,
      sector: user.sectors[0],
      content: paragraph("con adjunto"),
      attachments: [
        {
          type: "image",
          url: "https://example.test/foto.png",
          path: "post/foto.png",
          originalName: "foto.png",
          mimeType: "image/png",
          size: 10,
        },
      ],
    });

    const res = await client
      .put(`/api/posts/${post._id}`)
      .send({
        content: paragraph("editado"),
        attachments: [],
      });

    assert.equal(res.status, 200);

    const stored = await Post.findById(post._id);
    assert.equal(stored.content[0].text, "editado");
    assert.equal(stored.attachments.length, 1, "los adjuntos no deberían tocarse");
    assert.equal(stored.attachments[0].path, "post/foto.png");
  });

  it("otro collaborator no puede editar (403)", async () => {
    const autor = await userClient();
    const creado = await autor.client
      .post("/api/posts")
      .send({ content: paragraph("intacto") });

    const { client } = await userClient();
    const res = await client
      .put(`/api/posts/${creado.body.data._id}`)
      .send({ content: paragraph("hackeado") });

    assert.equal(res.status, 403);
  });

  it("un admin puede editar el post de otro", async () => {
    const autor = await userClient();
    const creado = await autor.client
      .post("/api/posts")
      .send({ content: paragraph("moderado") });

    const { client } = await adminClient();
    const res = await client
      .put(`/api/posts/${creado.body.data._id}`)
      .send({ content: paragraph("moderado por admin") });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.content[0].text, "moderado por admin");
  });

  it("devuelve 404 para un post inexistente", async () => {
    const { client } = await userClient();

    const res = await client
      .put("/api/posts/507f1f77bcf86cd799439011")
      .send({ content: paragraph("nada") });

    assert.equal(res.status, 404);
  });
});

describe("DELETE /api/posts/:id", () => {
  it("el autor desactiva el post y desaparece del listado", async () => {
    const { client } = await userClient();
    const creado = await client
      .post("/api/posts")
      .send({ content: paragraph("temporal") });

    const res = await client.delete(`/api/posts/${creado.body.data._id}`);

    assert.equal(res.status, 200);

    const stored = await Post.findById(creado.body.data._id);
    assert.equal(stored.active, false);

    const list = await client.get("/api/posts");
    assert.ok(!list.body.data.posts.some((p) => p._id === creado.body.data._id));
  });

  it("borra las notificaciones que apuntan al post", async () => {
    const autor = await userClient();
    const creado = await autor.client
      .post("/api/posts")
      .send({ content: paragraph("con aviso") });
    const postId = creado.body.data._id;

    await Notification.create({
      recipient: autor.user._id,
      post: postId,
      category: "forum",
      type: "post_like",
      title: "A alguien le gustó tu publicación",
    });

    assert.equal(await Notification.countDocuments({ post: postId }), 1);

    const res = await autor.client.delete(`/api/posts/${postId}`);

    assert.equal(res.status, 200);
    assert.equal(await Notification.countDocuments({ post: postId }), 0);
  });

  it("otro collaborator no puede desactivar (403)", async () => {
    const autor = await userClient();
    const creado = await autor.client
      .post("/api/posts")
      .send({ content: paragraph("intacto") });

    const { client } = await userClient();
    const res = await client.delete(`/api/posts/${creado.body.data._id}`);

    assert.equal(res.status, 403);

    const stored = await Post.findById(creado.body.data._id);
    assert.equal(stored.active, true);
  });

  it("devuelve 404 para un post inexistente", async () => {
    const { client } = await userClient();

    const res = await client.delete("/api/posts/507f1f77bcf86cd799439011");

    assert.equal(res.status, 404);
  });
});
