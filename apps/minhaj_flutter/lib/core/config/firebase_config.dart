import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

abstract final class MinhajFirebaseConfig {
  // Public Firebase client configuration for the legacy web app.
  // Access control must be enforced by Firebase Auth and Security Rules.
  static const _legacyWebApiKey = 'AIzaSyCSe5Rgsr6_JneRvhtZilHmTfga8LCYZUo';
  static const _legacyWebAppId = '1:780231348130:web:cafdef92ee081e12b02cfb';
  static const _legacyProjectId = 'minhaj-1be6f';
  static const _legacySenderId = '780231348130';
  static const _legacyAuthDomain = 'minhaj-1be6f.firebaseapp.com';
  static const _legacyStorageBucket = 'minhaj-1be6f.firebasestorage.app';

  // Android client configuration defaults. These are public client values,
  // not service-account credentials. Build-time defines may override them.
  static const _androidApiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: 'AIzaSyCFR51oEQ2I2ekaqZBAOegVCff7wYBIlMY',
  );
  static const _androidAppId = String.fromEnvironment(
    'FIREBASE_APP_ID',
    defaultValue: '1:780231348130:android:a93034490b78c894b02cfb',
  );
  static const _androidMessagingSenderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '780231348130',
  );
  static const _androidProjectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'minhaj-1be6f',
  );
  static const _androidStorageBucket = String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
    defaultValue: 'minhaj-1be6f.firebasestorage.app',
  );

  // Optional web overrides remain separate so the Android defaults never
  // accidentally replace the existing web app ID or API key.
  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const _messagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _authDomain = String.fromEnvironment('FIREBASE_AUTH_DOMAIN');
  static const _storageBucket =
      String.fromEnvironment('FIREBASE_STORAGE_BUCKET');

  static bool get isConfigured => true;

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return FirebaseOptions(
        apiKey: _apiKey.isNotEmpty ? _apiKey : _legacyWebApiKey,
        appId: _appId.isNotEmpty ? _appId : _legacyWebAppId,
        messagingSenderId: _messagingSenderId.isNotEmpty
            ? _messagingSenderId
            : _legacySenderId,
        projectId: _projectId.isNotEmpty ? _projectId : _legacyProjectId,
        authDomain: _authDomain.isNotEmpty ? _authDomain : _legacyAuthDomain,
        storageBucket:
            _storageBucket.isNotEmpty ? _storageBucket : _legacyStorageBucket,
      );
    }

    return FirebaseOptions(
      apiKey: _androidApiKey,
      appId: _androidAppId,
      messagingSenderId: _androidMessagingSenderId,
      projectId: _androidProjectId,
      storageBucket: _androidStorageBucket,
    );
  }

  static String get statusLabel => isConfigured
      ? 'تم إعداد Firebase'
      : 'وضع المعاينة: يلزم إعداد Firebase لتطبيق أندرويد';
}
