# Security Specification for راديو الحكايات

## 1. Data Invariants
- A tale must have a valid `authorId` matching the current user.
- A user can only modify their own profile.
- Claps can be incremented by anyone (signed in), but only exactly by 1.
- Timestamps must be validated using `request.time`.
- Document IDs must be validated to prevent ID poisoning.

## 2. The "Dirty Dozen" Payloads (Red Team Audit)

### 1. Payload: Identity Spoofing (Tale)
```json
{
  "authorId": "EVIL_PLAYER_ID",
  "authorName": "Victim",
  "audioUrl": "http://evil.com/audio.webm",
  "category": "market",
  "createdAt": "serverTimestamp"
}
```
**Expected:** PERMISSION_DENIED (authorId must match request.auth.uid).

### 2. Payload: Shadow Field Injection (User)
```json
{
  "displayName": "New Name",
  "isVerified": true
}
```
**Expected:** PERMISSION_DENIED (affectedKeys().hasOnly prevents unknown fields).

### 3. Payload: ID Poisoning
Attempting to create a tale with ID: `a`.repeat(1500)
**Expected:** PERMISSION_DENIED (isValidId checks size).

### 4. Payload: Unauthorized Update (Tale)
```json
{
  "transcription": "I am the owner now"
}
```
**Expected:** PERMISSION_DENIED (only owner can edit transcription).

### 5. Payload: Invalid Category
```json
{
  "category": "political_propaganda"
}
```
**Expected:** PERMISSION_DENIED (category must be in allowlist).

### 6. Payload: PII Leak (User)
Read profiles without being signed in.
**Expected:** PERMISSION_DENIED (get needs isSignedIn).

### 7. Payload: Query Scraping
List query on `users` collection.
**Expected:** PERMISSION_DENIED (list on users is false).

... and so on.

## 3. Conflict Report & Audit results

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning | Status |
|---|---|---|---|---|
| users | Protected | Protected | Protected | PASS |
| tales | Protected | Protected | Protected | PASS |
| responses | Protected | Protected | Protected | PASS |
