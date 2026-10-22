import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Like from "../src/models/like.model.js";
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
    .send({ content: paragraph("post para likear") });
  return { autor, postId: res.body.data._id };
}

describe("POST /api/posts/:postId/like", () => {
  it("exige autenticación", async () => {
    const { postId } = await postFixture();

    const res = await request(app).post(`/api/posts/${postId}/like`);

    assert.equal(res.status, 401);
  });

  it("registra el like, incrementa likesCount y notifica al autor", async () => {
    const { autor, postId } = await postFixture();
    const { user: liker, client } = await userClient();

    const res = await client.post(`/api/posts/${postId}/like`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.liked, true);
    assert.equal(res.body.data.likesCount, 1);

    const post = await Post.findById(postId);
    assert.equal(post.likesCount, 1);

    const notificacion = await Notification.findOne({
      recipient: autor.user._id,
      type: "post_like",
    });
    assert.ok(notificacion, "debería existir la notificación de like");
    assert.equal(notificacion.category, "forum");
    assert.equal(notificacion.post.toString(), postId);
    assert.equal(notificacion.actor.toString(), liker._id.toString());
    assert.equal(notificacion.dedupeKey, `like:${postId}:${liker._id}`);
  });

  it("es idempotente: likear dos veces no duplica like ni notificación", async () => {
    const { autor, postId } = await postFixture();
    const { user: liker, client } = await userClient();

    await client.post(`/api/posts/${postId}/like`);
    const res = await client.post(`/api/posts/${postId}/like`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.likesCount, 1);
    assert.equal(await Like.countDocuments({ post: postId, user: liker._id }), 1);
    assert.equal(
      await Notification.countDocuments({ recipient: autor.user._id }),
      1,
    );
  });

  it("no notifica al autor de la propia acción (auto-like)", async () => {
    const { autor, postId } = await postFixture();

    const res = await autor.client.post(`/api/posts/${postId}/like`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.likesCount, 1);
    assert.equal(
      await Notification.countDocuments({ recipient: autor.user._id }),
      0,
    );
  });

  it("devuelve 404 para un post inexistente", async () => {
    const { client } = await userClient();

    const res = await client.post("/api/posts/507f1f77bcf86cd799439011/like");

    assert.equal(res.status, 404);
  });
});

describe("DELETE /api/posts/:postId/like", () => {
  it("quita el like y decrementa likesCount", async () => {
    const { postId } = await postFixture();
    const { user: liker, client } = await userClient();

    await client.post(`/api/posts/${postId}/like`);
    const res = await client.delete(`/api/posts/${postId}/like`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.liked, false);
    assert.equal(res.body.data.removed, true);
    assert.equal(res.body.data.likesCount, 0);
    assert.equal(await Like.countDocuments({ post: postId, user: liker._id }), 0);
  });

  it("volver a likear no genera una segunda notificación (dedupe)", async () => {
    const { autor, postId } = await postFixture();
    const { client } = await userClient();

    await client.post(`/api/posts/${postId}/like`);
    await client.delete(`/api/posts/${postId}/like`);
    await client.post(`/api/posts/${postId}/like`);

    assert.equal(await Notification.countDocuments({ recipient: autor.user._id }), 1);
  });

  it("quitar un like que no existe es un no-op", async () => {
    const { postId } = await postFixture();
    const { client } = await userClient();

    const res = await client.delete(`/api/posts/${postId}/like`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.removed, false);
    assert.equal(res.body.data.likesCount, 0);
  });

  it("devuelve 404 para un post inexistente", async () => {
    const { client } = await userClient();

    const res = await client.delete("/api/posts/507f1f77bcf86cd799439011/like");

    assert.equal(res.status, 404);
  });
});
