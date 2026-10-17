import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/config/firebase_config.dart';
import 'features/admin/presentation/admin_page.dart';
import 'features/assistant/presentation/assistant_page.dart';
import 'features/library/presentation/library_page.dart';
import 'features/auth/presentation/profile_page.dart';
import 'features/branches/presentation/branches_page.dart';
import 'features/cards/presentation/flashcards_page.dart';
import 'features/cards/presentation/shared_flashcards_page.dart';
import 'features/home/presentation/home_page.dart';
import 'features/resources/presentation/resources_page.dart';
import 'features/schools/presentation/schools_page.dart';
import 'features/shell/presentation/main_shell.dart';
import 'features/suggestions/presentation/suggestions_page.dart';
import 'features/tests/presentation/tests_page.dart';

final _router = GoRouter(
  initialLocation: '/',
  routes: [
    ShellRoute(
      builder: (context, state, child) => MainShell(location: state.uri.path, child: child),
      routes: [
        GoRoute(path: '/', builder: (context, state) => const HomePage()),
        GoRoute(path: '/branches', builder: (context, state) => const BranchesPage()),
        GoRoute(path: '/resources', builder: (context, state) => ResourcesPage(initialBranchId: state.uri.queryParameters['branchId'])),
        GoRoute(path: '/foundations', builder: (context, state) => const LibraryPage(collectionName: 'foundations', title: 'التأسيس')),
        GoRoute(path: '/solutions', builder: (context, state) => const LibraryPage(collectionName: 'solutions', title: 'الحلول')),
        GoRoute(path: '/assistant', builder: (context, state) => const AssistantPage()),
        GoRoute(path: '/schools', builder: (context, state) => const SchoolsPage()),
        GoRoute(path: '/curriculum', builder: (context, state) => const LibraryPage(collectionName: 'curriculumUnits', title: 'الوحدات الدراسية')),
        GoRoute(path: '/cards', builder: (context, state) => const FlashcardsPage()),
        GoRoute(path: '/cards/shared/:shareId', builder: (context, state) => SharedFlashcardsPage(shareId: state.pathParameters['shareId']!)),
        GoRoute(path: '/cards/:setId', builder: (context, state) => FlashcardsPage(setId: state.pathParameters['setId'])),
        GoRoute(path: '/tests', builder: (context, state) => const TestsPage()),
        GoRoute(path: '/suggestions', builder: (context, state) => const SuggestionsPage()),
        GoRoute(path: '/profile', builder: (context, state) => const ProfilePage()),
        GoRoute(path: '/admin', builder: (context, state) => const AdminPage()),
      ],
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
            seedColor: teal, primary: navy, secondary: teal, surface: const Color(0xFFF7F9FC),
          ),
          scaffoldBackgroundColor: const Color(0xFFF7F9FC),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFFF7F9FC), foregroundColor: navy, centerTitle: false,
          ),
          cardTheme: CardThemeData(
            elevation: 0, color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: Color(0xFFE5EAF2)),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true, fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE5EAF2))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE5EAF2))),
          ),
        ),
      ),
    );
  }
}

String get firebaseSetupStatus => MinhajFirebaseConfig.statusLabel;
