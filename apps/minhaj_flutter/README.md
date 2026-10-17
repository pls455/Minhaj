# MINHAJ Flutter app

This directory contains the Flutter Android/Web application. It is kept separate from the existing production website until parity, security, and behavior are verified.

## Web preview

The web build defaults to the existing public Firebase web client configuration for project `minhaj-1be6f`. This is client configuration, not an admin secret. Firestore Rules and Firebase Authentication settings must continue to enforce access.

Do not deploy the Flutter web app to a public production URL until its queries, administrator role flows, and Firestore indexes have been tested against the project.

Optional web overrides:
```sh
flutter run -d chrome \
  --dart-define=FIREBASE_API_KEY=YOUR_WEB_API_KEY \
  --dart-define=FIREBASE_APP_ID=YOUR_WEB_APP_ID \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID \
  --dart-define=FIREBASE_PROJECT_ID=minhaj-1be6f \
  --dart-define=FIREBASE_AUTH_DOMAIN=minhaj-1be6f.firebaseapp.com \
  --dart-define=FIREBASE_STORAGE_BUCKET=minhaj-1be6f.firebasestorage.app
```

## Android configuration

Android client configuration for Firebase project `minhaj-1be6f` and application ID `com.karam.minhaj` is included as default values in `lib/core/config/firebase_config.dart`. You can build an APK without entering Firebase values again:

```sh
flutter build apk --release
```

To override the defaults for a different build, pass `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_MESSAGING_SENDER_ID`, and `FIREBASE_PROJECT_ID` with `--dart-define`.

Firebase client configuration is expected to be present in a client app. It does not grant administrator access by itself. Firestore Rules and Firebase Authentication must enforce permissions. Never commit service-account JSON, private service-account keys, admin credentials, or AI-provider secrets.

## Current features

- Arabic RTL responsive shell and navigation
- Branch, subject, resource, foundation, solution, curriculum, school and directorate browsing
- Student email/password authentication and profile
- Student flashcard sets, review cards, shareable set pages and copy-to-account
- Public platform tests and personal MCQ tests
- Student source suggestions and problem reports
- Role-aware catalog/resource administration, suggestion publishing and report review
- Study assistant using the existing Cloudflare Worker endpoint
- GitHub Actions: `flutter pub get`, `flutter analyze`, `flutter test`, and web release build

This is an incremental migration. CI results and live Firebase smoke tests must pass before merge or production rollout.
