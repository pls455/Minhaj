import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/firebase_config.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 680;
    return ListView(
      padding: EdgeInsets.all(compact ? 16 : 28),
      children: [
        Container(
          padding: EdgeInsets.all(compact ? 22 : 36),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: const LinearGradient(
              begin: Alignment.topRight, end: Alignment.bottomLeft,
              colors: [Color(0xFF172554), Color(0xFF0F766E)],
            ),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                width: 58,
                height: 58,
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: SvgPicture.asset(
                  'assets/minhaj_logo.svg',
                  fit: BoxFit.contain,
                  semanticsLabel: 'شعار منهاج',
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Text(
                  'مِنهَاج',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 25,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ]),
            const SizedBox(height: 20),
            const Text('طريقك للتوجيهي، أوضح', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800, height: 1.35)),
            const SizedBox(height: 10),
            const Text('مصادرك وموادك التعليمية في مكان واحد.', style: TextStyle(color: Color(0xFFE2E8F0), fontSize: 16, height: 1.7)),
            const SizedBox(height: 22),
            FilledButton.icon(
              onPressed: () => context.go('/resources'),
              style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: const Color(0xFF172554), padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14)),
              icon: const Icon(Icons.arrow_back_rounded),
              label: const Text('استكشف المصادر'),
            ),
          ]),
        ),
        const SizedBox(height: 20),
        Card(child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [
          const Icon(Icons.sync_rounded, color: Color(0xFF0F766E)),
          const SizedBox(width: 10),
          Expanded(child: Text(MinhajFirebaseConfig.statusLabel, style: const TextStyle(fontSize: 13, height: 1.5))),
        ]))),
        const SizedBox(height: 24),
        Text('ابدأ من هون', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF172554))),
        const SizedBox(height: 14),
        LayoutBuilder(builder: (context, constraints) {
          final columns = constraints.maxWidth >= 900 ? 3 : constraints.maxWidth >= 540 ? 2 : 1;
          final tiles = <_HomeTileData>[
            _HomeTileData(Icons.school_rounded, 'الفروع والمواد', 'اختَر فرعك وشاهد المواد المرتبطة به', '/branches'),
            _HomeTileData(Icons.library_books_rounded, 'المصادر التعليمية', 'ملفات وروابط مرتبة حسب المادة', '/resources'),
            _HomeTileData(Icons.style_rounded, 'بطاقاتي', 'أنشئ بطاقات للمراجعة والاستذكار', '/cards'),
            _HomeTileData(Icons.quiz_rounded, 'الاختبارات', 'اختبارات منشورة وتدريب شخصي', '/tests'),
            _HomeTileData(Icons.lightbulb_outline_rounded, 'اقترح مصدرًا', 'ساعد في تحسين مكتبة منهاج التعليمية', '/suggestions'),
            _HomeTileData(Icons.bookmark_add_outlined, 'التأسيس', 'راجع المفاهيم والمواد الأساسية', '/foundations'),
            _HomeTileData(Icons.task_alt_rounded, 'الحلول', 'شروحات وحلول منشورة للطلاب', '/solutions'),
            _HomeTileData(Icons.auto_awesome_rounded, 'مساعد منهاج', 'اسأل عن مفهوم دراسي مع حد استخدام عادل', '/assistant'),
            _HomeTileData(Icons.account_balance_rounded, 'دليل المدارس', 'ابحث عن مدرسة أو مديرية', '/schools'),
            _HomeTileData(Icons.account_tree_rounded, 'الوحدات الدراسية', 'تصفح وحدات المنهاج المنشورة', '/curriculum'),
            _HomeTileData(Icons.person_rounded, 'حساب الطالب', 'الدخول وحفظ المحتوى الشخصي', '/profile'),
          ];
          return GridView.count(
            crossAxisCount: columns, crossAxisSpacing: 12, mainAxisSpacing: 12,
            childAspectRatio: columns == 1 ? 3.3 : 1.6, shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: tiles.map((item) => _HomeTile(item: item)).toList(),
          );
        }),
        const SizedBox(height: 20),
        const Text('بيانات الطلاب والمحتوى تُحمّل من Firebase بعد إعداد المشروع. الأقسام التي تعتمد على الخدمات لا تستخدم بيانات وهمية.', style: TextStyle(color: Color(0xFF64748B), height: 1.7)),
      ],
    );
  }
}

class _HomeTileData {
  const _HomeTileData(this.icon, this.title, this.subtitle, this.path);
  final IconData icon;
  final String title, subtitle, path;
}

class _HomeTile extends StatelessWidget {
  const _HomeTile({required this.item});
  final _HomeTileData item;
  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: () => context.go(item.path),
      borderRadius: BorderRadius.circular(20),
      child: Padding(padding: const EdgeInsets.all(18), child: Row(children: [
        Container(width: 46, height: 46, decoration: BoxDecoration(color: const Color(0xFFE6F4F1), borderRadius: BorderRadius.circular(14)),
          child: Icon(item.icon, color: const Color(0xFF0F766E))),
        const SizedBox(width: 14),
        Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(item.title, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF172554))),
          const SizedBox(height: 4),
          Text(item.subtitle, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, height: 1.5)),
        ])),
        const Icon(Icons.chevron_left_rounded),
      ])),
    ),
  );
}
