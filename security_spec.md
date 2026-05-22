# Security Specification

## Data Invariants
1. A lead must contain a valid, non-empty email address.
2. Leads cannot have self-allocated premium tier modifications.
3. Users can only read their own user lead / private info.
4. Prompt history logs must be immutable once created.

## Dirty Dozen Payloads (Negative Tests)
1. Write a lead with arbitrary string ID longer than 128 characters.
2. Edit a lead with a changed `createdAt` field (immutability bypass).
3. Query all user leads anonymously without an owner ID check.
4. Modify `tier` from "free" to "premium" by an arbitrary user client.
5. Create a promptHistory document where `userId` doesn't match the current user ID.
6. Read another user's prompt history without authenticating.
...
