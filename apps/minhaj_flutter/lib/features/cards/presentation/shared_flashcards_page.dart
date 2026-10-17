import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/widgets/async_state.dart';

class SharedFlashcardsPage extends StatefulWidget {
  const SharedFlashcardsPage({super.key, required this.shareId});
  final String shareId;

  @override
  State<SharedFlashcardsPage> createState() => _SharedFlashcardsPageState();
}

class _SharedFlashcardsPageState extends State<SharedFlashcardsPage> {
  bool _copying = false;

  Future<void> _copyToAccount(
    User user,
    Map<String, dynamic> shared,
    List<Map<String, dynamic>> cards,
  ) async {
    if (_copying) return;
    if (cards.isEmpty || cards.length > 150) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('هذه المجموعة لا تحتوي على بطاقات صالحة للنسخ.')),
      );
      return;
    }
    setState(() => _copying = true);
    try {
      final db = FirebaseFirestore.instance;
      final setRef = db.collection('studentFlashcardSets').doc();
      final title = (shared['title'] ?? 'مجموعة مشتركة').toString();
      final description = (shared['description'] ?? '').toString();
      await setRef.set({
        'ownerId': user.uid,
        'title': title.length > 100 ? title.substring(0, 100) : title,
        'description': description.length > 450 ? description.substring(0, 450) : description,
        'cardCount': 0,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      final batch = db.batch();
      for (final card in cards) {
        final question = (card['question'] ?? '').toString().trim();
        final answer = (card['answer'] ?? '').toString().trim();
        if (question.isEmpty || answer.isEmpty || question.length > 4000 || answer.length > 8000) {
          continue;
        }
        final tags = card['tags'] is List
            ? (card['tags'] as List).map((item) => item.toString()).take(10).toList()
            : <String>[];
        final ref = setRef.collection('cards').doc();
        batch.set(ref, {
          'question': question,
          'answer': answer,
          'difficulty': (card['difficulty'] ?? 'متوسط').toString(),
          'tags': tags,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      final actualCards = cards.where((card) =>
        (card['question'] ?? '').toString().trim().isNotEmpty &&
        (card['answer'] ?? '').toString().trim().isNotEmpty &&
        (card['question'] ?? '').toString().length <= 4000 &&
        (card['answer'] ?? '').toString().length <= 8000
      ).length;
      if (actualCards == 0) {
        await setRef.delete();
        throw StateError('لا توجد بطاقات صالحة للنسخ.');
      }
      await setRef.update({
        'cardCount': actualCards,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم نسخ المجموعة إلى حسابك.')),
      );
      context.go('/cards/${setRef.id}');
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(firebaseErrorMessage(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _copying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isReady) return const AsyncStateView(icon: Icons.link_off_rounded, message: 'خدمة المشاركة تحتاج إعداد Firebase في هذه النسخة.');
    return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
    future: FirebaseFirestore.instance.collection('studentFlashcardShares').doc(widget.shareId).get(),
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return AsyncStateView(message: firebaseErrorMessage(snapshot.error!), onRetry: () => setState(() {}));
      }
      final document = snapshot.data;
      if (document == null || !document.exists) {
        return const AsyncStateView(icon: Icons.link_off_rounded, message: 'رابط المشاركة غير موجود أو لم يعد متاحًا.');
      }
      final shared = document.data() ?? <String, dynamic>{};
      final raw = shared['cards'];
      final cards = raw is List
          ? raw.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList()
          : <Map<String, dynamic>>[];
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(children: [
            IconButton(onPressed: () => context.go('/cards'), icon: const Icon(Icons.arrow_forward_rounded)),
            Expanded(child: Text((shared['title'] ?? 'مجموعة بطاقات مشتركة').toString(),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800))),
          ]),
          if ((shared['description'] ?? '').toString().trim().isNotEmpty)
            Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(shared['description'].toString(), style: const TextStyle(height: 1.6))),
          Text('${cards.length} بطاقة • مجموعة للقراءة والمراجعة',
            style: const TextStyle(color: Color(0xFF64748B))),
          const SizedBox(height: 14),
          StreamBuilder<User?>(
            stream: AuthService.authChanges(),
            initialData: AuthService.currentUser,
            builder: (context, userSnapshot) {
              final user = userSnapshot.data;
              if (user == null) {
                return FilledButton.icon(
                  onPressed: () => context.go('/profile'),
                  icon: const Icon(Icons.login_rounded),
                  label: const Text('سجّل الدخول لنسخ المجموعة إلى حسابك'),
                );
              }
              return FilledButton.icon(
                onPressed: _copying ? null : () => _copyToAccount(user, shared, cards),
                icon: _copying
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.copy_all_rounded),
                label: Text(_copying ? 'جارٍ نسخ المجموعة...' : 'نسخ إلى بطاقاتي'),
              );
            },
          ),
          const SizedBox(height: 12),
          if (cards.isEmpty) const Padding(
            padding: EdgeInsets.all(24),
            child: Text('لا تحتوي مجموعة المشاركة على بطاقات متاحة.'),
          ),
          ...cards.asMap().entries.map((entry) => _SharedCard(index: entry.key + 1, data: entry.value)),
        ],
      );
    },
  );
  }
}

class _SharedCard extends StatefulWidget {
  const _SharedCard({required this.index, required this.data});
  final int index;
  final Map<String, dynamic> data;
  @override
  State<_SharedCard> createState() => _SharedCardState();
}
class _SharedCardState extends State<_SharedCard> {
  bool _answerVisible = false;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: Padding(padding: const EdgeInsets.all(16), child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('بطاقة ${widget.index}', style: const TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text((widget.data['question'] ?? '').toString(), style: const TextStyle(fontWeight: FontWeight.w700, height: 1.6)),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => setState(() => _answerVisible = !_answerVisible),
          icon: Icon(_answerVisible ? Icons.visibility_off_outlined : Icons.visibility_outlined),
          label: Text(_answerVisible ? 'إخفاء الإجابة' : 'عرض الإجابة'),
        ),
        if (_answerVisible) Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text((widget.data['answer'] ?? '').toString(), style: const TextStyle(height: 1.7)),
        ),
      ],
    )),
  );
}
