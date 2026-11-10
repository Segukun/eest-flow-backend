import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import Sector from "../src/models/sector.model.js";
import User from "../src/models/user.model.js";
import Post from "../src/models/post.model.js";
import { adminClient, userClient, createSector, createUser, resetDatabase, COLORS } from "./helpers.js";

beforeEach(resetDatabase);

describe("QA: limites existentes de formularios", () => {
  for (const length of [200, 201]) {
    it(`sector: crear con description de ${length}`, async () => {
      const { client } = await adminClient();
      const res = await client.post("/api/sectors").send({ name: "QA Sector", description: "a".repeat(length), color: COLORS.valid });
      assert.equal(res.status, length === 200 ? 201 : 400);
      const stored = await Sector.findOne({ name: "QA Sector" });
      if (length === 200) assert.equal(stored.description.length, 200);
      else assert.equal(stored, null);
    });
    it(`sector: editar con description de ${length}`, async () => {
      const sector = await createSector({ description: "Anterior" });
      const { client } = await adminClient();
      const res = await client.put(`/api/sectors/${sector._id}`).send({ description: "a".repeat(length) });
      assert.equal(res.status, length === 200 ? 200 : 400);
      assert.equal((await Sector.findById(sector._id)).description, length === 200 ? "a".repeat(200) : "Anterior");
    });
  }
  for (const length of [30, 31]) {
    it(`miembro: crear con nombre de ${length}`, async () => {
      const sector = await createSector();
      const { client } = await adminClient();
      const email = "qa-boundary@test.local";
      const res = await client.post("/api/auth/accounts").send({ name: "a".repeat(length), email, password: "secret123", sectors: [String(sector._id)] });
      assert.equal(res.status, length === 30 ? 200 : 400);
      const stored = await User.findOne({ email });
      if (length === 30) assert.equal(stored.name.length, 30);
      else assert.equal(stored, null);
    });
    it(`miembro: editar con nombre de ${length}`, async () => {
      const sector = await createSector();
      const user = await createUser({ name: "Anterior", sectors: [sector._id] });
      const { client } = await adminClient();
      const res = await client.put(`/api/users/${user._id}`).send({ name: "a".repeat(length) });
      assert.equal(res.status, length === 30 ? 200 : 400);
      assert.equal((await User.findById(user._id)).name, length === 30 ? "a".repeat(30) : "Anterior");
    });
  }
  for (const length of [5000, 5001]) {
    it(`foro: crear bloque de texto de ${length}`, async () => {
      const { client } = await userClient();
      const res = await client.post("/api/posts").send({ content: [{ type: "paragraph", text: "a".repeat(length) }] });
      assert.equal(res.status, length === 5000 ? 201 : 400);
      assert.equal(await Post.countDocuments({}), length === 5000 ? 1 : 0);
    });
    it(`foro: editar bloque de texto de ${length}`, async () => {
      const { client } = await userClient();
      const created = await client.post("/api/posts").send({ content: [{ type: "paragraph", text: "Anterior" }] });
      assert.equal(created.status, 201);
      const id = created.body.data._id;
      const res = await client.put(`/api/posts/${id}`).send({ content: [{ type: "paragraph", text: "a".repeat(length) }] });
      assert.equal(res.status, length === 5000 ? 200 : 400);
      assert.equal((await Post.findById(id)).content[0].text, length === 5000 ? "a".repeat(5000) : "Anterior");
    });
  }
});
