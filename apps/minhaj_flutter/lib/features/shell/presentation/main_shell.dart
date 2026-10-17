import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.location, required this.child});
  final String location;
  final Widget child;

  static const _destinations = <_NavDestination>[
    _NavDestination('/', 'الرئيسية', Icons.home_rounded),
    _NavDestination('/branches', 'الفروع', Icons.school_rounded),
    _NavDestination('/resources', 'المصادر', Icons.library_books_rounded),
    _NavDestination('/cards', 'بطاقاتي', Icons.style_rounded),
    _NavDestination('/tests', 'الاختبارات', Icons.quiz_rounded),
    _NavDestination('/suggestions', 'اقتراح', Icons.lightbulb_outline_rounded),
    _NavDestination('/profile', 'حسابي', Icons.person_rounded),
  ];

  int get _selectedIndex {
    if (location.startsWith('/cards')) return 3;
    if (location.startsWith('/tests')) return 4;
    for (var i = 0; i < _destinations.length; i++) {
      if (location == _destinations[i].path || (i > 0 && location.startsWith(_destinations[i].path))) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final title = location.startsWith('/admin') ? 'الإدارة' : location.startsWith('/assistant') ? 'مساعد منهاج' : location.startsWith('/foundations') ? 'التأسيس' : location.startsWith('/solutions') ? 'الحلول' : _destinations[_selectedIndex].label;
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          const Icon(Icons.menu_book_rounded, color: Color(0xFF0F766E)),
          const SizedBox(width: 10),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        ]),
        actions: [Padding(
          padding: const EdgeInsetsDirectional.only(end: 16),
          child: Center(child: Text('MINHAJ', style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: const Color(0xFF64748B), fontWeight: FontWeight.w800, letterSpacing: 1.1,
          ))),
        )],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1440),
          child: Row(children: [
            if (wide) ...[
              NavigationRail(
                selectedIndex: _selectedIndex,
                labelType: NavigationRailLabelType.all,
                onDestinationSelected: (index) => context.go(_destinations[index].path),
                destinations: _destinations.map((item) => NavigationRailDestination(
                  icon: Icon(item.icon), selectedIcon: Icon(item.icon), label: Text(item.label),
                )).toList(),
              ),
              const VerticalDivider(width: 1, thickness: 1),
            ],
            Expanded(child: child),
          ]),
        ),
      ),
      bottomNavigationBar: wide ? null : NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) => context.go(_destinations[index].path),
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        destinations: _destinations.map((item) => NavigationDestination(
          icon: Icon(item.icon), selectedIcon: Icon(item.icon), label: item.label,
        )).toList(),
      ),
    );
  }
}

class _NavDestination {
  const _NavDestination(this.path, this.label, this.icon);
  final String path;
  final String label;
  final IconData icon;
}
