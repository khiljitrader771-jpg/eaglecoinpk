# Eaglecoinpk Firestore Security Specification

## 1. Data Invariants
1. **Identity Ownership (PII Isolation)**: `/users/{userId}` and `/workspaces/{workspaceId}` can only be read, created, or updated by `request.auth.uid == userId` (with `email_verified == true`) or a verified admin (`anas03091118011@gmail.com` with `email_verified == true` or `/admins/{uid}`).
2. **Master Gate Sync**: `/workspaces/{workspaceId}/events/{eventId}` requires the parent workspace `/workspaces/{workspaceId}` to exist and have `ownerUid == request.auth.uid`. Ledger events are append-only (no client update/delete).
3. **Immutable Audit Fields**: `uid`, `ownerUid`, `proposerUid`, `voterUid`, `createdAt`, and `proposalId` are immutable once created. All timestamps (`createdAt`, `updatedAt`) must equal `request.time`.
4. **Governance Terminal State Locking**: Once a `/proposals/{proposalId}` document reaches `'Executed'` or `'Rejected'`, no further mutations are permitted unless performed by an admin.
5. **Atomic Vote Integrity**: `/proposals/{proposalId}/votes/{voterId}` enforces `voterId == request.auth.uid`, checks parent proposal existence and non-terminal status via `get()`, and strictly bounds `votePower > 0` and `choice in ['for', 'against', 'abstain']`.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read on `/users/{uid}` -> DENIED (`!isSignedIn()`).
2. Cross-user read on `/users/victimUid` by `attackerUid` -> DENIED (`!isOwner(userId)`).
3. Unverified email user (`email_verified: false`) writing to `/users/{uid}` -> DENIED (`!isVerifiedUser()`).
4. Shadow field injection (`isAdmin: true` or `role: "admin"`) on `/users/{uid}` create -> DENIED (`hasOnly` check).
5. Client-forged timestamp (`createdAt: "2020-01-01T00:00:00Z"`) on `/workspaces/{uid}/events/{id}` -> DENIED (`createdAt == request.time`).
6. Oversized document ID (`> 128` chars or containing `.` / `$`) on `/proposals/{badId}` -> DENIED (`isValidId()`).
7. Oversized `title` (`> 160` chars) or `description` (`> 2000` chars) on `/proposals/{id}` -> DENIED (`.size()` checks).
8. Updating an already `'Executed'` proposal -> DENIED (terminal state lock).
9. Spoofing another user's vote at `/proposals/{id}/votes/victimUid` -> DENIED (`voterId == request.auth.uid`).
10. Modifying immutable `proposerUid` or `title` during a proposal vote tally update -> DENIED (`affectedKeys().hasOnly(...)`).
11. Creating an orphan ledger event at `/workspaces/nonExistent/events/e1` -> DENIED (`exists` / `get` parent check).
12. Query scraping `/users` without owner/admin authorization -> DENIED (`allow list: if isAdmin() || resource.data.uid == request.auth.uid`).
