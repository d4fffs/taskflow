import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync('firestore.rules', 'utf8');
const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));

test('Dirty Dozen #1-12: Firestore rules enforce default deny, strict schemas, and RBAC gates', () => {
  // Global safety net
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);

  // Path variable hardening
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /\^\[a-zA-Z0-9_\\\\-\]\+\$/);

  // Email verification gate
  assert.match(rules, /request\.auth\.token\.email_verified == true/);

  // PII isolation on /users/{userId}
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*allow list: if false;/);

  // Viewer write denial (only owner, admin, member may write)
  assert.match(rules, /workspaceRole\(workspaceId\) in \['owner', 'admin', 'member'\]/);

  // Terminal state lock on invitations
  assert.match(rules, /match \/invitations\/\{invitationId\}[\s\S]*existing\(\)\.status == 'pending'/);

  // Temporal integrity on createdAt / updatedAt
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);

  // Every blueprint collection path has a corresponding match rule
  const expectedMatches = [
    'match /users/{userId}',
    'match /publicProfiles/{userId}',
    'match /workspaces/{workspaceId}',
    'match /members/{memberId}',
    'match /boards/{boardId}',
    'match /lists/{listId}',
    'match /tasks/{taskId}',
    'match /comments/{commentId}',
    'match /activities/{activityId}',
    'match /notifications/{notificationId}',
    'match /invitations/{invitationId}',
  ];
  for (const m of expectedMatches) {
    assert.ok(rules.includes(m), `Missing security rule block: ${m}`);
  }

  // Blueprint has all 11 entity schemas
  assert.ok(Object.keys(blueprint.entities).length >= 11);
});

test('Zero get()/exists() calls inside allow list blocks (Pillar 8 Cost Optimization)', () => {
  const listBlocks = [...rules.matchAll(/allow list:([^;]+);/g)].map((m) => m[1]);
  assert.ok(listBlocks.length >= 10, 'Expected at least 10 allow list rules');
  for (const block of listBlocks) {
    assert.ok(!block.includes('get('), `Forbidden get() in allow list: ${block}`);
    assert.ok(!block.includes('exists('), `Forbidden exists() in allow list: ${block}`);
    assert.ok(
      block.includes('false') || block.includes('resource.data'),
      `allow list must enforce resource.data scoping: ${block}`
    );
  }
});
