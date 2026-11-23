# TaskFlow Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Identity & PII Isolation**: Private profile records under `/users/{userId}` (containing `email`) are readable and writable exclusively by `request.auth.uid == userId`. Collaborator display metadata is isolated in `/publicProfiles/{userId}` with zero PII fields.
2. **Master Gate RBAC Enforcement**: Every workspace mutation and child resource write (`boards`, `lists`, `tasks`, `comments`, `activities`, `invitations`) verifies active membership via `/workspaces/{workspaceId}/members/{uid}`. Users with role `viewer` are denied all mutations; only `owner` and `admin` may manage workspace settings, invitations, or member roles; only `owner` may delete a workspace.
3. **Referential & Immutable Ownership Integrity**: A board must reference an existing workspace; a list must reference an existing board; a task must reference an existing board and list. `ownerId`, `workspaceId`, `boardId`, `userId`, and `createdAt` are immutable after creation.
4. **Temporal Integrity**: `createdAt` on create and `updatedAt` on update must equal server `request.time`.
5. **Volumetric & Key Hardening**: Document IDs must match `^[a-zA-Z0-9_\-]+$` (<= 128 chars). Every string enforces explicit `.size()` bounds; every array enforces strict upper bounds (`memberIds <= 50`, `assigneeIds <= 20`, `labelIds <= 10`, `checklists <= 10`, `attachments <= 10`, `mentions <= 10`). Shadow fields are blocked via `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.
6. **Terminal State Locking**: Once an invitation reaches `accepted` or `declined`, no subsequent updates are permitted.
7. **Secure List Queries**: Every `allow list` rule evaluates `resource.data` directly against `request.auth.uid` (no blanket `isSignedIn()` reads and no `get()`/`exists()` calls inside `allow list`).

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Class | Target Collection | Malicious Payload / Operation | Expected Result |
|---|--------------|-------------------|-------------------------------|-----------------|
| 1 | **Identity Spoofing** | `/workspaces/{id}` | Create workspace with `ownerId: "victim_uid"` while signed in as `"attacker_uid"` | `PERMISSION_DENIED` |
| 2 | **Shadow Field Injection** | `/tasks/{id}` | Update task injecting ghost field `{ isVerified: true, role: "owner" }` | `PERMISSION_DENIED` |
| 3 | **Viewer Privilege Escalation** | `/tasks/{id}` | Workspace `viewer` attempts to create or update a task title/position | `PERMISSION_DENIED` |
| 4 | **Self-Role Escalation** | `/workspaces/{w}/members/{uid}` | `member` attempts to update their own `role` field from `"member"` to `"owner"` | `PERMISSION_DENIED` |
| 5 | **PII Blanket Read** | `/users/{victimUid}` | Signed-in attacker performs `get` on another user's `/users/{victimUid}` | `PERMISSION_DENIED` |
| 6 | **ID Poisoning** | `/boards/{1500_char_junk}` | Create board with invalid characters / >128 char document ID | `PERMISSION_DENIED` |
| 7 | **Value Poisoning** | `/tasks/{id}` | Update allowed `priority` field to `"super_critical"` or 10KB string | `PERMISSION_DENIED` |
| 8 | **Immutable Field Tampering** | `/boards/{id}` | Update board attempting to change `workspaceId` or `ownerId` or `createdAt` | `PERMISSION_DENIED` |
| 9 | **Client Timestamp Spoofing** | `/comments/{id}` | Create comment with backdated `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` | `PERMISSION_DENIED` |
| 10 | **Unbounded Array / DoW** | `/tasks/{id}` | Create task with 25 `labelIds` (exceeds max 10) or >5000 char `description` | `PERMISSION_DENIED` |
| 11 | **Terminal State Bypass** | `/invitations/{id}` | Attempt to update an already `"accepted"` invitation back to `"pending"` | `PERMISSION_DENIED` |
| 12 | **Unscoped List Scraping** | `/notifications` | Signed-in user executes `list` query without scoping to `userId == auth.uid` | `PERMISSION_DENIED` |
