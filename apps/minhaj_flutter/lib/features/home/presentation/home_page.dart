import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < 680;

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.menu_book_rounded, color: Color(0xFF0F766E)),
            SizedBox(width: 10),
            Text('مِنهَاج'),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 16),
            child: Center(
              child: Text(
                'MINHAJ 2.0',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: const Color(0xFF64748B),
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: ListView(
            padding: EdgeInsets.all(compact ? 16 : 28),
            children: [
              Container(
                padding: EdgeInsets.all(compact ? 22 : 36),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  gradient: const LinearGradient(
                    begin: Alignment.topRight,
                    end: Alignment.bottomLeft,
                    colors: [Color(0xFF172554), Color(0xFF0F766E)],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'طريقك للتوجيهي، أوضح',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'مصادرك وموادك التعليمية في مكان واحد.',
                      style: TextStyle(
                        color: Color(0xFFE2E8F0),
                        fontSize: 16,
                        height: 1.7,
                      ),
                    ),
                    const SizedBox(height: 22),
                    FilledButton.icon(
                      onPressed: () => context.go('/resources'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF172554),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 14,
                        ),
                      ),
                      icon: const Icon(Icons.arrow_back_rounded),
                      label: const Text('استكشف المصادر'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'ابدأ من هون',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF172554),
                    ),
              ),
              const SizedBox(height: 14),
              LayoutBuilder(
                builder: (context, constraints) {
                  final columns = constraints.maxWidth >= 800
                      ? 3
                      : constraints.maxWidth >= 520
                          ? 2
                          : 1;
                  return GridView.count(
                    crossAxisCount: columns,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: columns == 1 ? 3.3 : 1.5,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _HomeTile(
                        icon: Icons.library_books_rounded,
                        title: 'المصادر التعليمية',
                        subtitle: 'ملفات وروابط مرتبة حسب المادة',
                        onTap: () => context.go('/resources'),
                      ),
                      const _HomeTile(
                        icon: Icons.school_rounded,
                        title: 'الفروع والمواد',
                        subtitle: 'اختيار المسار الدراسي المناسب',
                      ),
                      const _HomeTile(
                        icon: Icons.auto_stories_rounded,
                        title: 'البطاقات والمراجعة',
                        subtitle: 'مساحة للمراجعة والتثبيت',
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 20),
              const Text(
                'نسخة التطوير: بعض الأقسام قيد الربط ببيانات Firebase الحالية.',
                style: TextStyle(color: Color(0xFF64748B), height: 1.6),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeTile extends StatelessWidget {
  const _HomeTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F4F1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: const Color(0xFF0F766E)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF172554),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: Color(0xFF64748B),
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
