import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from './password';

test('password hashes can be verified without storing the password itself', async () => {
  const password = 'correct horse battery staple';
  const encoded = await hashPassword(password);

  assert.notEqual(encoded, password);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword('incorrect password', encoded), false);
});

test('malformed password hashes are rejected', async () => {
  assert.equal(await verifyPassword('anything', 'not-a-valid-hash'), false);
  assert.equal(await verifyPassword('anything', ''), false);
});
