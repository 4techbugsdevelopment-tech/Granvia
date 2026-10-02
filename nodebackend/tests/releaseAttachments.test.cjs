const { test } = require('node:test');
const assert = require('node:assert/strict');

// Exercise the compiled controller without a database or persistent uploads.
const application = { id: 'app', employerUserId: 'employer', guardUserId: 'associate', status: 'hired', jobId: 'job', job: { title: 'Carpenter' } };
let saved, stored = [], removed = [], failTransaction = false;
const prisma = {
  jobApplication: { findUnique: async () => application, findMany: async () => [{ ...application, releaseAttachments: saved?.releaseAttachments }] },
  notification: { createMany: async () => ({ count: 1 }) },
  $transaction: async fn => {
    if (failTransaction) throw new Error('Database failure');
    return fn({ jobApplication: { update: async ({ data }) => { saved = { ...application, ...data }; return saved; } }, applicationStatusLog: { create: async () => ({}) }, jobOffer: { updateMany: async () => ({ count: 1 }) } });
  },
};
const storage = {
  storeFile: (category, owner, file) => { const path = category + '/' + owner + '/' + file.originalname; stored.push(path); return { path }; },
  removePrivateFile: path => removed.push(path),
  urlFor: (category, path, base) => base + '/api/files/download?path=' + encodeURIComponent(path) + '&signature=fresh',
};
for (const [path, exports] of [['../dist/prisma', { prisma }], ['../dist/utils/fileStorage', storage]]) {
  const filename = require.resolve(path);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const { releaseAssociate, mine } = require('../dist/controllers/applicationController');
const file = (name, type, size = 10) => ({ originalname: name, mimetype: type, size, buffer: Buffer.alloc(10) });
const request = files => ({ params: { application: 'app' }, user: { id: 'employer', role: 'employer' }, body: { reason: 'Requirement ended' }, files });
const response = () => ({ json(value) { this.body = value; return this; } });

test('release attachments remain visible to the Associate through fresh private links', async () => {
  const res = response();
  await releaseAssociate(request([file('letter.pdf', 'application/pdf'), file('photo.webp', 'image/webp')]), res);
  assert.equal(saved.status, 'released');
  assert.equal(JSON.parse(saved.releaseAttachments).length, 2);
  assert.equal(res.body.release_attachments[0].name, 'letter.pdf');
  assert.ok(res.body.release_attachments[0].download_url.startsWith('https://aip.granvia.llc/api/files/download?'));
  assert.equal(res.body.release_attachments[0].path, undefined);
  const associateRes = response();
  await mine({ user: { id: 'associate' } }, associateRes);
  assert.equal(associateRes.body[0].release_attachments[1].name, 'photo.webp');
});

test('rejects unrelated files, empty files, oversized files, and another employer', async () => {
  for (const upload of [file('notes.txt', 'text/plain'), file('photo.png', 'image/png', 0), file('letter.pdf', 'application/pdf', 10 * 1024 * 1024 + 1)]) {
    await assert.rejects(releaseAssociate(request([upload]), response()));
  }
  await assert.rejects(releaseAssociate({ ...request([]), user: { id: 'other', role: 'employer' } }, response()), /Forbidden/);
});

test('removes uploaded files when the release transaction fails', async () => {
  failTransaction = true;
  const before = removed.length;
  await assert.rejects(releaseAssociate(request([file('rollback.pdf', 'application/pdf')]), response()), /Database failure/);
  assert.equal(removed.length, before + 1);
  assert.equal(removed.at(-1), stored.at(-1));
  failTransaction = false;
});

test('release without an attachment remains supported', async () => {
  await releaseAssociate(request(undefined), response());
  assert.deepEqual(JSON.parse(saved.releaseAttachments), []);
});
