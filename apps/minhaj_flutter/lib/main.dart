import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app.dart';
import 'core/config/firebase_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (MinhajFirebaseConfig.isConfigured) {
    await Firebase.initializeApp(
      options: MinhajFirebaseConfig.currentPlatform,
    );
  }

  runApp(const MinhajApp());
}
