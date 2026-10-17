# MINHAJ Flutter Migration Audit

## Scope

This audit was performed against the GitHub repository `pls455/Minhaj` on the `main` branch before adding the Flutter foundation. No production files, Firebase data, Firestore rules, or deployments were changed during the audit.

## Existing implementation

- The current public site is a vanilla HTML/CSS/JavaScript ES-module application.
- Firebase project referenced by the current client: `minhaj-1be6f`.
- Authentication uses Firebase Authentication; application data uses Cloud Firestore.
- Existing repository documentation describes a repository/service boundary, bounded pagination, stable IDs, and no destructive data migration.
- Existing role names include `reviewer`, `content_admin`, and `super_admin`.
- Existing content includes branches, subjects, categories, resources, foundations, solutions, flashcards, curriculum units, templates, suggestions, problem reports, source registry, and admin logs.
- Student-specific features include profiles, AI usage limits, personal flashcard sets/cards, flashcard shares, personal tests, and test shares.
- The existing project also contains school/directorate data and an AI retrieval flow through a Cloudflare Worker.

## Migration constraints

1. Keep the current production site and its deployment untouched while the Flutter application is developed on a separate branch and in a separate directory.
2. Reuse the existing Firebase project only after validating the actual deployed rules, indexes, authentication providers, and data shape.
3. Never run a destructive migration or bulk rewrite against production data as part of the initial Flutter rollout.
4. Preserve legacy field aliases where necessary, including `branchId` versus `branchIds`, and normalize them in repositories.
5. Enforce authorization in Firestore Rules, not only in Flutter UI.
6. Use bounded, cursor-based pagination for resource collections. Do not load the complete `resources` collection.
7. Do not expose service-account credentials or privileged secrets in Flutter/web builds. Client Firebase configuration is not a substitute for access control.
8. Test existing features and permissions before switching traffic or changing deployment settings.

## Known validation gaps

- Reading repository files does not prove the live Firebase rules or production data exactly match the checked-in files.
- A full inventory of production documents and authentication-provider settings requires Firebase project access and should be performed read-only.
- Existing Firestore indexes must be checked against the queries implemented by the new repositories.
- The current AI flow must be tested separately; a UI rebuild alone does not establish that retrieval or model behavior is correct.

## Initial implementation strategy

- Add Flutter as an isolated application under `apps/minhaj_flutter/`.
- Start with a compiling app shell, Arabic RTL, responsive navigation, and explicit Firebase configuration through build-time defines.
- Implement repositories and screens feature-by-feature, validating each against existing contracts.
- Keep the existing web app available until parity checks pass.
