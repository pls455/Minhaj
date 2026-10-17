# MINHAJ Flutter app

This directory contains the new Flutter application for Android and Web. It is intentionally isolated from the existing production website while feature parity is developed and verified.

## Requirements

- Flutter stable with Dart 3.4 or newer
- A Firebase project configuration for the existing MINHAJ Firebase project
- Android SDK for Android builds

## Configure Firebase

Pass Firebase client configuration at build time. Do not add service-account JSON, admin credentials, or privileged secrets to the repository.

Example (replace values with the project's current Firebase client configuration):

```sh
flutter run \
  --dart-define=FIREBASE_API_KEY=YOUR_API_KEY \
  --dart-define=FIREBASE_APP_ID=YOUR_APP_ID \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID \
  --dart-define=FIREBASE_PROJECT_ID=minhaj-1be6f \
  --dart-define=FIREBASE_AUTH_DOMAIN=minhaj-1be6f.firebaseapp.com \
  --dart-define=FIREBASE_STORAGE_BUCKET=minhaj-1be6f.firebasestorage.app
```

The app shell can start without Firebase configuration for UI development. Firebase-dependent features must remain unavailable until configuration is supplied.

## Initial scope

- Arabic RTL app shell
- Responsive Android/Web navigation
- Firebase initialization from build-time configuration
- Feature-first directory structure for incremental migration

This is the foundation only, not a claim that all legacy features have already been migrated.
