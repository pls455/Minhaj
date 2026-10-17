import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

abstract final class MinhajFirebaseConfig {
  // The old web client configuration is public client metadata already used by
  // the legacy site. Rules, not these values, must protect production data.
  static const _legacyWebApiKey = 'AIzaSyCSe5Rgsr6_JneRvhtZilHmTfga8LCYZUo';
  static const _legacyWebAppId = '1:780231348130:web:cafdef92ee081e12b02cfb';
  static const _legacyProjectId = 'minhaj-1be6f';
  static const _legacySenderId = '780231348130';
  static const _legacyAuthDomain = 'minhaj-1be6f.firebaseapp.com';
  static const _legacyStorageBucket = 'minhaj-1be6f.firebasestorage.app';

  // Mobile builds must be supplied with the platform-specific Firebase app
  // values generated for the registered Android app, never the web app ID.
  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const _messagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _authDomain = String.fromEnvironment('FIREBASE_AUTH_DOMAIN');
  static const _storageBucket =
      String.fromEnvironment('FIREBASE_STORAGE_BUCKET');

  static bool get isConfigured {
    if (kIsWeb) return true;
    return _apiKey.isNotEmpty &&
        _appId.isNotEmpty &&
        _messagingSenderId.isNotEmpty &&
        _projectId.isNotEmpty;
  }

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
      apiKey: _apiKey,
      appId: _appId,
      messagingSenderId: _messagingSenderId,
      projectId: _projectId,
      authDomain: _authDomain.isEmpty ? null : _authDomain,
      storageBucket: _storageBucket.isEmpty ? null : _storageBucket,
    );
  }

  static String get statusLabel => isConfigured
      ? 'تم إعداد Firebase'
      : 'وضع المعاينة: يلزم إعداد Firebase لتطبيق أندرويد';
}
