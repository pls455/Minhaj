# MINHAJ Flutter app

This directory contains the Flutter Android/Web application. It is kept separate from the existing production website until parity, security, and behavior are verified.

## Web preview

The web build defaults to the existing public Firebase **web client** configuration for project `minhaj-1be6f`. This is client configuration, not an admin secret. Firestore Rules and Firebase Authentication settings must continue to enforce access.

Do not deploy the Flutter web app to a public production URL until its queries, administrator role flows, and Firestore indexes have been tested against the project.

Override the web settings using:
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

Register an Android app in the existing Firebase project `minhaj-1be6f` using the exact Android application ID. Generate its **Android-specific** Firebase configuration (FlutterFire CLI or Firebase Console), then pass the Android app's `apiKey`, `appId`, `messagingSenderId`, and `projectId` through build-time defines. The web `appId` must not be reused as the Android app ID.

Example:
```sh
flutter build apk --release \
  --dart-define=FIREBASE_API_KEY=YOUR_ANDROID_API_KEY \
  --dart-define=FIREBASE_APP_ID=YOUR_ANDROID_APP_ID \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID \
  --dart-define=FIREBASE_PROJECT_ID=minhaj-1be6f
```

Do not commit service-account JSON, admin credentials, AI-provider secrets, or other privileged credentials. Firebase client configuration is not authorization; Firestore Rules are.

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
