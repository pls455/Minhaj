import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/widgets/async_state.dart';

class FlashcardsPage extends StatefulWidget {
  const FlashcardsPage({super.key, this.setId});
  final String? setId;
  @override
  State<FlashcardsPage> createState() => _FlashcardsPageState();
}

class _FlashcardsPageState extends State<FlashcardsPage> {
  bool _busy = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isReady) {
      return const AsyncStateView(icon: Icons.style_outlined, message: 'البطاقات الشخصية تحتاج إعداد Firebase وتسجيل الدخول.');
    }
    final user = AuthService.currentUser;
    if (user == null) {
      return const _PublicFlashcards();
    }
    if (widget.setId != null) return _setView(user, widget.setId!);
    return _setsView(user);
  }

  Widget _setsView(User user) => StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
    stream: FirebaseFirestore.instance.collection('studentFlashcardSets')
      .where('ownerId', isEqualTo: user.uid).limit(50).snapshots(),
    builder: (context, snapshot) {
      if (snapshot.hasError) return AsyncStateView(message: firebaseErrorMessage(snapshot.error!), onRetry: () => setState(() {}));
      if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
      final sets = snapshot.data!.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
      sets.sort((a, b) => _dateOf(b['updatedAt']).compareTo(_dateOf(a['updatedAt'])));
      return ListView(padding: const EdgeInsets.all(20), children: [
        Text('بطاقاتي التعليمية', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('أنشئ مجموعات صغيرة للمفاهيم والتعاريف والأسئلة التي تحتاج مراجعتها.'),
        const SizedBox(height: 16),
        FilledButton.icon(onPressed: _busy ? null : () => _createSet(user), icon: const Icon(Icons.add_rounded), label: const Text('إنشاء مجموعة جديدة')),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C)))),
        const SizedBox(height: 14),
        if (sets.isEmpty) const Padding(padding: EdgeInsets.all(28), child: Column(children: [
          Icon(Icons.style_outlined, size: 42, color: Color(0xFF94A3B8)),
          SizedBox(height: 10), Text('لسه ما أنشأت أي مجموعة بطاقات. ابدأ بمجموعة واحدة لمادة بتراجعها.'),
        ])),
        ...sets.map((item) => Card(margin: const EdgeInsets.only(bottom: 10), child: ListTile(
          leading: const CircleAvatar(child: Icon(Icons.style_rounded)),
          title: Text((item['title'] ?? 'مجموعة بطاقات').toString(), style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text((item['description'] ?? '').toString() + ' • ' + ((item['cardCount'] ?? 0).toString()) + ' بطاقة'),
          trailing: const Icon(Icons.chevron_left_rounded),
          onTap: () => context.go('/cards/' + item['id'].toString()),
        ))),
      ]);
    },
  );

  Future<void> _createSet(User user) async {
    final title = TextEditingController();
    final description = TextEditingController();
    final result = await showDialog<Map<String, String>?>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('مجموعة جديدة'),
        content: SizedBox(width: 420, child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: title, autofocus: true, maxLength: 120, decoration: const InputDecoration(labelText: 'اسم المجموعة')),
          const SizedBox(height: 8),
          TextField(controller: description, maxLength: 500, maxLines: 2, decoration: const InputDecoration(labelText: 'وصف اختياري')),
        ]))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(context, {'title': title.text.trim(), 'description': description.text.trim()}), child: const Text('إنشاء')),
        ],
      ),
    );
    title.dispose(); description.dispose();
    if (result == null || result['title']!.isEmpty || !mounted) return;
    setState(() { _busy = true; _error = null; });
    try {
      final doc = await FirebaseFirestore.instance.collection('studentFlashcardSets').add({
        'ownerId': user.uid, 'title': result['title'], 'description': result['description'],
        'cardCount': 0, 'createdAt': FieldValue.serverTimestamp(), 'updatedAt': FieldValue.serverTimestamp(),
      });
      if (mounted) context.go('/cards/' + doc.id);
    } catch (error) {
      if (mounted) setState(() => _error = firebaseErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _setView(User user, String setId) => StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
    stream: FirebaseFirestore.instance.collection('studentFlashcardSets').doc(setId).snapshots(),
    builder: (context, setSnapshot) {
      if (setSnapshot.hasError) return AsyncStateView(message: firebaseErrorMessage(setSnapshot.error!));
      if (!setSnapshot.hasData) return const Center(child: CircularProgressIndicator());
      final setDoc = setSnapshot.data!;
      if (!setDoc.exists || setDoc.data()?['ownerId'] != user.uid) {
        return const AsyncStateView(icon: Icons.lock_outline_rounded, message: 'هذه المجموعة غير موجودة أو لا تملك صلاحية الوصول إليها.');
      }
      final setData = setDoc.data()!;
      return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: setDoc.reference.collection('cards').orderBy('createdAt').limit(150).snapshots(),
        builder: (context, cardSnapshot) {
          if (cardSnapshot.hasError) return AsyncStateView(message: firebaseErrorMessage(cardSnapshot.error!));
          if (!cardSnapshot.hasData) return const Center(child: CircularProgressIndicator());
          final cards = cardSnapshot.data!.docs;
          return ListView(padding: const EdgeInsets.all(20), children: [
            Row(children: [
              IconButton(onPressed: () => context.go('/cards'), icon: const Icon(Icons.arrow_forward_rounded), tooltip: 'كل المجموعات'),
              Expanded(child: Text((setData['title'] ?? 'مجموعة البطاقات').toString(), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800))),
            ]),
            if ((setData['description'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(setData['description'].toString())),
            FilledButton.icon(onPressed: cards.length >= 150 ? null : () => _addCard(setDoc.reference, cards.length),
              icon: const Icon(Icons.add_rounded), label: const Text('إضافة بطاقة')),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: cards.isEmpty ? null : () => _shareSet(user, setId, setData, setDoc.reference),
              icon: const Icon(Icons.share_rounded),
              label: const Text('إنشاء رابط مشاركة للمجموعة'),
            ),
            if (cards.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('أضف أول بطاقة. اكتب السؤال بوضوح والإجابة بأسلوب يساعدك على التذكر.')),
            ...cards.map((card) => _FlashcardTile(
              data: card.data(),
              onDelete: () => _deleteCard(card.reference, setDoc.reference, cards.length),
            )),
          ]);
        },
      );
    },
  );

  Future<void> _addCard(DocumentReference<Map<String, dynamic>> setRef, int count) async {
    final question = TextEditingController(), answer = TextEditingController();
    String difficulty = 'متوسط';
    final values = await showDialog<Map<String, String>?>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) => AlertDialog(
        title: const Text('إضافة بطاقة'),
        content: SizedBox(width: 440, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: question, autofocus: true, maxLength: 4000, maxLines: 3, decoration: const InputDecoration(labelText: 'السؤال أو المفهوم')),
          const SizedBox(height: 8),
          TextField(controller: answer, maxLength: 8000, maxLines: 4, decoration: const InputDecoration(labelText: 'الإجابة أو الشرح')),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(initialValue: difficulty, decoration: const InputDecoration(labelText: 'الصعوبة'),
            items: const [DropdownMenuItem(value: 'سهل', child: Text('سهل')), DropdownMenuItem(value: 'متوسط', child: Text('متوسط')), DropdownMenuItem(value: 'صعب', child: Text('صعب'))],
            onChanged: (value) { if (value != null) setDialogState(() => difficulty = value); }),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(context, {'question': question.text.trim(), 'answer': answer.text.trim(), 'difficulty': difficulty}), child: const Text('حفظ البطاقة')),
        ],
      )),
    );
    question.dispose(); answer.dispose();
    if (values == null || values['question']!.isEmpty || values['answer']!.isEmpty || !mounted) return;
    try {
      final batch = FirebaseFirestore.instance.batch();
      final card = setRef.collection('cards').doc();
      batch.set(card, {
        'question': values['question'], 'answer': values['answer'], 'difficulty': values['difficulty'],
        'tags': <String>[], 'createdAt': FieldValue.serverTimestamp(), 'updatedAt': FieldValue.serverTimestamp(),
      });
      batch.update(setRef, {'cardCount': count + 1, 'updatedAt': FieldValue.serverTimestamp()});
      await batch.commit();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }

  Future<void> _deleteCard(DocumentReference<Map<String, dynamic>> cardRef, DocumentReference<Map<String, dynamic>> setRef, int count) async {
    final ok = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('حذف البطاقة؟'), content: const Text('سيتم حذف هذه البطاقة نهائيًا.'),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف'))],
    ));
    if (ok != true) return;
    try {
      final batch = FirebaseFirestore.instance.batch();
      batch.delete(cardRef);
      batch.update(setRef, {'cardCount': count > 0 ? count - 1 : 0, 'updatedAt': FieldValue.serverTimestamp()});
      await batch.commit();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }


  Future<void> _shareSet(
    User user,
    String setId,
    Map<String, dynamic> setData,
    DocumentReference<Map<String, dynamic>> setRef,
  ) async {
    try {
      final snapshot = await setRef.collection('cards').orderBy('createdAt').limit(150).get();
      final shareCards = snapshot.docs.map((doc) {
        final data = doc.data();
        return <String, dynamic>{
          'question': (data['question'] ?? '').toString(),
          'answer': (data['answer'] ?? '').toString(),
          'difficulty': (data['difficulty'] ?? 'متوسط').toString(),
          'tags': data['tags'] is List ? data['tags'] : <String>[],
        };
      }).where((card) =>
        (card['question'] as String).isNotEmpty &&
        (card['answer'] as String).isNotEmpty
      ).toList();

      if (shareCards.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('أضف بطاقات قبل إنشاء رابط المشاركة.')),
          );
        }
        return;
      }
      final encoded = jsonEncode(shareCards);
      if (utf8.encode(encoded).length > 700000) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('المجموعة كبيرة جدًا للمشاركة كرابط واحد. قسّمها إلى مجموعات أصغر.')),
          );
        }
        return;
      }

      await FirebaseFirestore.instance.collection('studentFlashcardShares').doc(setId).set({
        'ownerId': user.uid,
        'title': (setData['title'] ?? 'مجموعة بطاقات').toString(),
        'description': (setData['description'] ?? '').toString(),
        'cardCount': shareCards.length,
        'cards': shareCards,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      if (!mounted) return;
      final shareLink = Uri.base.replace(fragment: '/cards/shared/' + setId).toString();
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('رابط المشاركة جاهز'),
          content: SelectableText(shareLink, style: const TextStyle(height: 1.6)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('إغلاق'),
            ),
            FilledButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: shareLink));
                if (dialogContext.mounted) Navigator.pop(dialogContext);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('تم نسخ رابط المشاركة.')),
                  );
                }
              },
              icon: const Icon(Icons.copy_rounded),
              label: const Text('نسخ الرابط'),
            ),
          ],
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(firebaseErrorMessage(error))),
        );
      }
    }
  }

  DateTime _dateOf(dynamic value) => value is Timestamp ? value.toDate() : DateTime.fromMillisecondsSinceEpoch(0);
}

class _FlashcardTile extends StatefulWidget {
  const _FlashcardTile({required this.data, required this.onDelete});
  final Map<String, dynamic> data;
  final VoidCallback? onDelete;
  @override
  State<_FlashcardTile> createState() => _FlashcardTileState();
}
class _FlashcardTileState extends State<_FlashcardTile> {
  bool _showAnswer = false;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(top: 10),
    child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(_showAnswer ? 'الإجابة' : 'السؤال', style: const TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.w800)),
      const SizedBox(height: 7),
      Text((_showAnswer ? widget.data['answer'] : widget.data['question']).toString(), style: const TextStyle(height: 1.65)),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(child: OutlinedButton.icon(onPressed: () => setState(() => _showAnswer = !_showAnswer),
          icon: Icon(_showAnswer ? Icons.visibility_off_outlined : Icons.visibility_outlined), label: Text(_showAnswer ? 'إخفاء الإجابة' : 'عرض الإجابة'))),
        if (widget.onDelete != null) IconButton(onPressed: widget.onDelete, tooltip: 'حذف البطاقة', icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFB91C1C))),
      ]),
    ])),
  );
}

class _PublicFlashcards extends StatelessWidget {
  const _PublicFlashcards();

  @override
  Widget build(BuildContext context) => FutureBuilder<QuerySnapshot<Map<String, dynamic>>>(
    future: FirebaseFirestore.instance.collection('flashcards').where('active', isEqualTo: true).limit(50).get(),
    builder: (context, snapshot) {
      if (snapshot.hasError) return AsyncStateView(message: firebaseErrorMessage(snapshot.error!));
      if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
      final cards = snapshot.data!.docs;
      if (cards.isEmpty) return Center(child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.style_outlined, size: 42, color: Color(0xFF0F766E)),
          const SizedBox(height: 12), const Text('لا توجد بطاقات عامة منشورة حاليًا.', textAlign: TextAlign.center),
          const SizedBox(height: 12), FilledButton(onPressed: () => context.go('/profile'), child: const Text('إنشاء بطاقات شخصية')),
        ]),
      ));
      return ListView(padding: const EdgeInsets.all(20), children: [
        Text('بطاقات مراجعة عامة', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('يمكنك مراجعة البطاقات العامة دون حساب. سجّل الدخول لإنشاء مجموعاتك الخاصة.'),
        const SizedBox(height: 14),
        ...cards.map((doc) => _FlashcardTile(data: doc.data(), onDelete: null)),
        const SizedBox(height: 14),
        OutlinedButton.icon(onPressed: () => context.go('/profile'), icon: const Icon(Icons.person_add_alt_1_rounded), label: const Text('سجّل الدخول لإنشاء بطاقاتك')),
      ]);
    },
  );
}
