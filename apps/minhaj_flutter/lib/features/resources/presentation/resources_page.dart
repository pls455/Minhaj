import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ResourcesPage extends StatelessWidget {
  const ResourcesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'العودة للرئيسية',
          onPressed: () => context.go('/'),
          icon: const Icon(Icons.arrow_forward_rounded),
        ),
        title: const Text('المصادر التعليمية'),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 620),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.cloud_sync_rounded,
                      size: 42,
                      color: Color(0xFF0F766E),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'ربط المصادر بقاعدة البيانات',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'هذه شاشة تأسيسية. الخطوة التالية هي تنفيذ مستودع مصادر يستخدم ترقيمًا بالصفحات وفلاتر الفروع والمواد، مع الحفاظ على شكل البيانات الحالي.',
                      textAlign: TextAlign.center,
                      style: TextStyle(height: 1.7, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
