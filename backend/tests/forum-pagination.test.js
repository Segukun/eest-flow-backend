import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import Post from '../src/models/post.model.js';
import { app, request, userClient, createSector, createUser, createPost, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
const paragraph = text => [{ type: 'paragraph', text }];

describe('Forum pagination and global search', () => {
  it('paginates beyond 50 posts with real totals and no repeated IDs', async () => {
    const {client,user}=await userClient();
    await Post.insertMany(Array.from({length:65},(_,i)=>({author:user._id,sector:user.sectors[0],content:paragraph(`Post ${i}`),createdAt:new Date(2026,0,1,0,i),pinned:i===0})));
    const seen=new Set();
    for(let page=1;page<=7;page++) {
      const res=await client.get('/api/posts').query({page,limit:10});
      assert.equal(res.status,200);
      assert.deepEqual(res.body.data.pagination,{page,limit:10,total:65,totalPages:7});
      assert.equal(res.body.data.posts.length,page===7?5:10);
      if(page===1)assert.equal(res.body.data.posts[0].pinned,true);
      for(const post of res.body.data.posts){assert.ok(!seen.has(post._id));seen.add(post._id);}
    }
    assert.equal(seen.size,65);
  });

  it('searches older posts beyond the first 50 and counts before paginating', async () => {
    const {client,user}=await userClient();
    await Post.insertMany(Array.from({length:75},(_,i)=>({author:user._id,sector:user.sectors[0],content:paragraph(i<15?`Aguja ${i}`:`Otro ${i}`),createdAt:new Date(2026,0,1,0,i)})));
    const first=await client.get('/api/posts').query({limit:50});
    assert.ok(first.body.data.posts.every(p=>!p.content[0].text.includes('Aguja')));
    const res=await client.get('/api/posts').query({search:'  AGUJA  ',page:2,limit:10});
    assert.equal(res.status,200);
    assert.deepEqual(res.body.data.pagination,{page:2,limit:10,total:15,totalPages:2});
    assert.equal(res.body.data.posts.length,5);
    assert.ok(res.body.data.posts.every(p=>p.content[0].text.includes('Aguja')));
  });

  for(const field of ['author','sector'])it(`searches by ${field} across the feed`,async()=>{
    const {client,user}=await userClient();
    const sector=await createSector({name:'Robotica'});
    const author=await createUser({name:'Mariana Rossi',sectors:[sector._id]});
    const match=await createPost({author:author._id,sector:sector._id,content:paragraph('Contenido')});
    await createPost({author:user._id,sector:user.sectors[0],content:paragraph('Otro')});
    const res=await client.get('/api/posts').query({search:field==='author'?'mariana':'robotica'});
    assert.equal(res.status,200);
    assert.deepEqual(res.body.data.posts.map(p=>p._id),[String(match._id)]);
    assert.equal(res.body.data.pagination.total,1);
  });

  it('treats regex punctuation as literal text',async()=>{
    const {client,user}=await userClient();
    const match=await createPost({author:user._id,sector:user.sectors[0],content:paragraph('Ejemplo .* [abc] + ?')});
    await createPost({author:user._id,sector:user.sectors[0],content:paragraph('No coincide')});
    for(const search of ['.*','[abc]','+','?']){
      const res=await client.get('/api/posts').query({search});
      assert.equal(res.status,200);
      assert.deepEqual(res.body.data.posts.map(p=>p._id),[String(match._id)]);
    }
  });

  it('combines search, sector and active filters and preserves empty search',async()=>{
    const {client,user}=await userClient();const other=await createSector();
    const base={author:user._id,content:paragraph('Coincidencia')};
    const match=await createPost({...base,sector:user.sectors[0]});
    await createPost({...base,sector:other._id});
    await createPost({...base,sector:user.sectors[0],active:false});
    const res=await client.get('/api/posts').query({search:'coincidencia',sectorId:String(user.sectors[0])});
    assert.equal(res.status,200);assert.deepEqual(res.body.data.posts.map(p=>p._id),[String(match._id)]);
    const blank=await client.get('/api/posts').query({search:'  '});assert.equal(blank.body.data.pagination.total,2);
    const empty=await client.get('/api/posts').query({search:'inexistente'});assert.equal(empty.body.data.posts.length,0);assert.equal(empty.body.data.pagination.totalPages,0);
  });

  it('keeps authentication, ID checks and pagination bounds',async()=>{
    assert.equal((await request(app).get('/api/posts?search=hola')).status,401);
    const {client}=await userClient();
    assert.equal((await client.get('/api/posts?search=uno&search=dos')).status,400);
    assert.equal((await client.get('/api/posts').query({search:'hola',sectorId:'invalid'})).status,400);
    const res=await client.get('/api/posts').query({page:0,limit:500});assert.equal(res.status,200);assert.equal(res.body.data.pagination.page,1);assert.equal(res.body.data.pagination.limit,50);
  });
});
