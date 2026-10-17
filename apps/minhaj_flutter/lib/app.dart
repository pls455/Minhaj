import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/config/firebase_config.dart';
import 'features/home/presentation/home_page.dart';
import 'features/resources/presentation/resources_page.dart';

final _router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomePage(),
    ),
    GoRoute(
      path: '/resources',
      builder: (context, state) => const ResourcesPage(),
    ),
  ],
);

class MinhajApp extends StatelessWidget {
  const MinhajApp({super.key});

  @override
  Widget build(BuildContext context) {
    const navy = Color(0xFF172554);
    const teal = Color(0xFF0F766E);

    return ProviderScope(
      child: MaterialApp.router(
        title: 'مِنهَاج | MINHAJ',
        debugShowCheckedModeBanner: false,
        routerConfig: _router,
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        ),
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: teal,
            primary: navy,
            secondary: teal,
            surface: const Color(0xFFF7F9FC),
          ),
          scaffoldBackgroundColor: const Color(0xFFF7F9FC),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFFF7F9FC),
            foregroundColor: navy,
            centerTitle: false,
          ),
          cardTheme: CardThemeData(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: Color(0xFFE5EAF2)),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE5EAF2)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE5EAF2)),
            ),
          ),
        ),
      ),
    );
  }
}

String get firebaseSetupStatus => MinhajFirebaseConfig.statusLabel;
