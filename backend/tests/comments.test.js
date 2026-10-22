import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Comment from "../src/models/comment.model.js";
import Notification from "../src/models/notification.model.js";
import Post from "../src/models/post.model.js";
import {
  app,
  request,
  resetDatabase,
  userClient,
} from "./helpers.js";

beforeEach(resetDatabase);

const paragraph = (text) => [{ type: "paragraph", text }];

async function postFixture() {
  const autor = await userClient();
  const res = await autor.client
    .post("/api/posts")
    .send({ content: paragraph("post de prueba") });
  return { autor, postId: res.body.data._id };
}

describe("POST /api/posts/:postId/comments", () => {
  it("exige autenticación", async () => {
    const { postId } = await postFixture();

    const res = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "hola" });

    assert.equal(res.status, 401);
  });

  it("crea el comentario, incrementa commentsCount y notifica al autor del post", async () => {
    const { autor, postId } = await postFixture();
    const { user: comentarista, client } = await userClient();

    const res = await client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "buen aporte" });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.content, "buen aporte");
    assert.equal(res.body.data.author._id, comentarista._id.toString());

    const post = await Post.findById(postId);
    assert.equal(post.commentsCount, 1);

    const notificacion = await Notification.findOne({
      recipient: autor.user._id,
      type: "post_comment",
    });
    assert.ok(notificacion, "debería existir la notificación para el autor");
    assert.equal(notificacion.category, "forum");
    assert.equal(notificacion.post.toString(), postId);
    assert.equal(notificacion.actor.toString(), comentarista._id.toString());
    assert.equal(notificacion.read, false);
    assert.match(notificacion.description, /buen aporte/);
  });

  it("una respuesta notifica al autor del comentario, no al del post", async () => {
    const { autor, postId } = await postFixture();
    const { user: comentarista, client: comentaristaClient } = await userClient();

    const comentario = await comentaristaClient
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "comentario padre" });
    const parentCommentId = comentario.body.data._id;

    await Notification.deleteMany({});

    const { user: respondedor, client } = await userClient();
    const res = await client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "una respuesta", parentCommentId });

    assert.equal(res.status, 201);

    const notificacion = await Notification.findOne({ type: "comment_reply" });
    assert.ok(notificacion, "debería existir la notificación de respuesta");
    assert.equal(notificacion.recipient.toString(), comentarista._id.toString());
    assert.equal(notificacion.actor.toString(), respondedor._id.toString());
    assert.equal(notificacion.post.toString(), postId);

    assert.equal(
      await Notification.countDocuments({ recipient: autor.user._id }),
      0,
      "el autor del post no debería recibir aviso por una respuesta",
    );
  });

  it("no notifica al autor de la propia acción (comentarse a sí mismo)", async () => {
    const { autor, postId } = await postFixture();

    const res = await autor.client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "me comento solo" });

    assert.equal(res.status, 201);
    assert.equal(
      await Notification.countDocuments({ recipient: autor.user._id }),
      0,
    );
  });

  it("rechaza un contenido vacío con 400", async () => {
    const { postId } = await postFixture();
    const { client } = await userClient();

    const res = await client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "   " });

    assert.equal(res.status, 400);
    assert.equal(await Comment.countDocuments({}), 0);
  });

  it("devuelve 404 para un post inexistente", async () => {
    const { client } = await userClient();

    const res = await client
      .post("/api/posts/507f1f77bcf86cd799439011/comments")
      .send({ content: "fantasma" });

    assert.equal(res.status, 404);
  });

  it("devuelve 404 si el comentario padre no pertenece al post", async () => {
    const { postId } = await postFixture();
    const { client } = await userClient();

    const res = await client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "respuesta", parentCommentId: "507f1f77bcf86cd799439011" });

    assert.equal(res.status, 404);
  });
});

describe("GET /api/posts/:postId/comments", () => {
  it("exige autenticación", async () => {
    const { postId } = await postFixture();

    const res = await request(app).get(`/api/posts/${postId}/comments`);

    assert.equal(res.status, 401);
  });

  it("devuelve solo los comentarios activos", async () => {
    const { postId } = await postFixture();
    const { client } = await userClient();

    const creado = await client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "visible" });
    await Comment.create({
      post: postId,
      author: (await userClient()).user._id,
      content: "borrado",
      active: false,
    });

    const res = await client.get(`/api/posts/${postId}/comments`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.comments.length, 1);
    assert.equal(res.body.data.comments[0]._id, creado.body.data._id);
    assert.equal(res.body.data.pagination.total, 1);
  });
});

describe("PUT /api/comments/:id", () => {
  it("el autor edita su comentario y persiste", async () => {
    const { postId } = await postFixture();
    const { client } = await userClient();

    const creado = await client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "antes" });

    const res = await client
      .put(`/api/comments/${creado.body.data._id}`)
      .send({ content: "despues" });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.content, "despues");

    const stored = await Comment.findById(creado.body.data._id);
    assert.equal(stored.content, "despues");
  });

  it("otro collaborator no puede editar (403)", async () => {
    const { postId } = await postFixture();
    const autor = await userClient();
    const creado = await autor.client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "intacto" });

    const { client } = await userClient();
    const res = await client
      .put(`/api/comments/${creado.body.data._id}`)
      .send({ content: "hackeado" });

    assert.equal(res.status, 403);
  });

  it("devuelve 404 para un comentario inexistente", async () => {
    const { client } = await userClient();

    const res = await client
      .put("/api/comments/507f1f77bcf86cd799439011")
      .send({ content: "nada" });

    assert.equal(res.status, 404);
  });
});

describe("DELETE /api/comments/:id", () => {
  it("el autor desactiva el comentario y decrementa commentsCount", async () => {
    const { postId } = await postFixture();
    const { client } = await userClient();

    const creado = await client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "efímero" });

    const res = await client.delete(`/api/comments/${creado.body.data._id}`);

    assert.equal(res.status, 200);

    const stored = await Comment.findById(creado.body.data._id);
    assert.equal(stored.active, false);

    const post = await Post.findById(postId);
    assert.equal(post.commentsCount, 0);
  });

  it("otro collaborator no puede desactivar (403)", async () => {
    const { postId } = await postFixture();
    const autor = await userClient();
    const creado = await autor.client
      .post(`/api/posts/${postId}/comments`)
      .send({ content: "intacto" });

    const { client } = await userClient();
    const res = await client.delete(`/api/comments/${creado.body.data._id}`);

    assert.equal(res.status, 403);

    const stored = await Comment.findById(creado.body.data._id);
    assert.equal(stored.active, true);
  });

  it("devuelve 404 para un comentario inexistente", async () => {
    const { client } = await userClient();

    const res = await client.delete("/api/comments/507f1f77bcf86cd799439011");

    assert.equal(res.status, 404);
  });
});
