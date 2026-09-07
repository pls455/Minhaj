# Minhaj Admin CMS v2

## Principles
- Subject is the central content entity.
- Existing Firestore collections are preserved; this phase does not delete or migrate data.
- Resource duplicate detection is based on URL only.
- Source registry is an ingestion/review inbox, not published student content.
- Admin actions are auditable.

## Existing collections
- `branches`
- `subjects`
- `categories`
- `resources`
- `sourceRegistry`
- `suggestions`
- `admins`
- `adminLogs`

## Planned content collections
- `topics`
- `foundations`
- `solutions`
- `flashcards`
- `problemReports`
- `templates`

## Admin workflows
1. New source enters `sourceRegistry`.
2. AI classification proposes subject/category/type/keywords.
3. Admin reviews and edits the proposal.
4. Approved content becomes a `resource` or another supported content type.
5. Publishing changes are logged in `adminLogs`.
6. Bulk operations must be validated before committing.

## Resource lifecycle
`draft -> pending_review -> published -> archived`

`active` remains a compatibility field for the current application; new admin code should prefer `status`.

## Resource identity
A resource is considered a duplicate only when its normalized URL matches an existing resource URL. Title similarity, keywords, file size, and content similarity are not duplicate criteria.

## Firestore safety
- Keep authorization in Firestore Security Rules, not only the client UI.
- Preserve existing admin role checks.
- Do not expose service-account credentials in the web application.
