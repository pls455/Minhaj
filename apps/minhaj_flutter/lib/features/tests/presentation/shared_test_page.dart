import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/widgets/async_state.dart';
import 'tests_page.dart';

class SharedTestPage extends StatelessWidget {
  const SharedTestPage({super.key, required this.shareId});
  final String shareId;

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isReady) return const AsyncStateView(icon: Icons.link_off_rounded, message: 'خدمة مشاركة الاختبارات تحتاج إعداد Firebase في هذه النسخة.');
    return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
    future: FirebaseFirestore.instance.collection('studentTestShares').doc(shareId).get(),
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return AsyncStateView(message: firebaseErrorMessage(snapshot.error!));
      }
      final document = snapshot.data;
      if (document == null || !document.exists) {
        return const AsyncStateView(icon: Icons.link_off_rounded, message: 'رابط الاختبار غير موجود أو لم يعد متاحًا.');
      }
      final data = document.data() ?? <String, dynamic>{};
      final rawQuestions = data['questions'];
      final questions = rawQuestions is List ? rawQuestions : const <dynamic>[];
      final title = (data['title'] ?? 'اختبار مشترك').toString();
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(children: [
            IconButton(onPressed: () => context.go('/tests'), icon: const Icon(Icons.arrow_forward_rounded)),
            Expanded(child: Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800))),
          ]),
          const SizedBox(height: 8),
          Text('${questions.length} سؤال • اختبار تدريبي تمت مشاركته معك'),
          const SizedBox(height: 16),
          if (questions.isEmpty) const AsyncStateView(icon: Icons.quiz_outlined, message: 'لا يحتوي رابط المشاركة على أسئلة قابلة للتشغيل.'),
          if (questions.isNotEmpty) FilledButton.icon(
            onPressed: () => showDialog<void>(
              context: context,
              builder: (_) => QuizRunner(title: title, questions: questions),
            ),
            icon: const Icon(Icons.play_arrow_rounded),
            label: const Text('ابدأ الاختبار'),
          ),
          const SizedBox(height: 8),
          if (questions.isNotEmpty) StreamBuilder<User?>(
            stream: AuthService.authChanges(),
            initialData: AuthService.currentUser,
            builder: (context, userSnapshot) {
              final user = userSnapshot.data;
              if (user == null || !AuthService.isReady || data['ownerId'] == user.uid) {
                return const SizedBox.shrink();
              }
              return OutlinedButton.icon(
                onPressed: () => _copyTest(context, user, data, questions),
                icon: const Icon(Icons.copy_all_rounded),
                label: const Text('نسخ الاختبار إلى حسابي'),
              );
            },
          ),
          const SizedBox(height: 16),
          const Text('الاختبار المشترك للتدريب فقط. النتيجة تظهر في الجلسة ولا تُحفظ كسجل علامة رسمي.', style: TextStyle(color: Color(0xFF58655F), height: 1.7)),
        ],
      );
    },
  );
  }

  Future<void> _copyTest(
    BuildContext context,
    User user,
    Map<String, dynamic> shared,
    List<dynamic> questions,
  ) async {
    if (questions.isEmpty || questions.length > 50) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('عدد الأسئلة غير صالح للنسخ.')));
      return;
    }
    try {
      final rawTitle = (shared['title'] ?? 'اختبار مشترك').toString();
      final title = ('$rawTitle (نسخة)').length > 200
          ? ('$rawTitle (نسخة)').substring(0, 200)
          : '$rawTitle (نسخة)';
      await FirebaseFirestore.instance.collection('studentTests').add({
        'ownerId': user.uid,
        'title': title,
        'questions': questions,
        'durationMinutes': (shared['durationMinutes'] as num?)?.toInt() ?? 0,
        'passingScore': (shared['passingScore'] as num?)?.toDouble() ?? 0,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم نسخ الاختبار إلى حسابك.')));
        context.go('/tests');
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
      }
    }
  }
}
