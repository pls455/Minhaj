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
import 'features/tests/presentation/shared_test_page.dart';

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
        GoRoute(path: '/tests/shared/:shareId', builder: (context, state) => SharedTestPage(shareId: state.pathParameters['shareId']!)),
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
    const forest = Color(0xFF173F35);
    const gold = Color(0xFFC5A46D);
    const ivory = Color(0xFFF6F3EA);
    const charcoal = Color(0xFF26332F);
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
            seedColor: forest, primary: forest, secondary: gold, surface: ivory,
          ),
          scaffoldBackgroundColor: ivory,
          appBarTheme: const AppBarTheme(
            backgroundColor: ivory, foregroundColor: forest, centerTitle: false,
          ),
          textTheme: ThemeData.light().textTheme.apply(bodyColor: charcoal, displayColor: forest),
          filledButtonTheme: FilledButtonThemeData(
            style: FilledButton.styleFrom(
              backgroundColor: forest,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
          navigationBarTheme: const NavigationBarThemeData(
            backgroundColor: Colors.white,
            indicatorColor: Color(0xFFE8EFE9),
          ),
          cardTheme: CardThemeData(
            elevation: 0, color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: Color(0xFFE5E0D5)),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true, fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE5E0D5))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE5E0D5))),
          ),
        ),
      ),
    );
  }
}

String get firebaseSetupStatus => MinhajFirebaseConfig.statusLabel;
