import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/widgets/async_state.dart';

class TestsPage extends StatefulWidget {
  const TestsPage({super.key});
  @override
  State<TestsPage> createState() => _TestsPageState();
}

class _TestsPageState extends State<TestsPage> {
  @override
  Widget build(BuildContext context) {
    if (!AuthService.isReady) return const AsyncStateView(icon: Icons.quiz_outlined, message: 'الاختبارات تحتاج إعداد Firebase في نسخة التطبيق.');
    final user = AuthService.currentUser;
    return ListView(padding: const EdgeInsets.all(20), children: [
      Text('الاختبارات والتدريب', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
      const SizedBox(height: 6),
      const Text('تدرّب على الاختبارات المنشورة أو أنشئ اختبارًا قصيرًا من سؤال اختيار من متعدد.'),
      const SizedBox(height: 16),
      if (user == null) OutlinedButton.icon(
        onPressed: () => context.go('/profile'), icon: const Icon(Icons.login_rounded), label: const Text('سجّل الدخول لحفظ اختباراتك'),
      ) else FilledButton.icon(
        onPressed: () => _createQuiz(user), icon: const Icon(Icons.add_rounded), label: const Text('إنشاء اختبار تدريبي'),
      ),
      const SizedBox(height: 22),
      Text('اختبارات المنصة', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      const _PublicTests(),
      if (user != null) ...[
        const SizedBox(height: 22),
        Text('اختباراتي', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        _MyTests(user: user),
      ],
    ]);
  }

  Future<void> _createQuiz(User user) async {
    final title = TextEditingController();
    final question = TextEditingController();
    final optionControllers = List.generate(4, (_) => TextEditingController());
    var correctIndex = 0;
    final result = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) => AlertDialog(
        title: const Text('إنشاء اختبار من سؤال واحد'),
        content: SizedBox(width: 480, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: title, autofocus: true, maxLength: 200, decoration: const InputDecoration(labelText: 'اسم الاختبار')),
          const SizedBox(height: 8),
          TextField(controller: question, maxLength: 1500, maxLines: 3, decoration: const InputDecoration(labelText: 'نص السؤال')),
          const SizedBox(height: 12),
          ...List.generate(4, (index) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: TextField(controller: optionControllers[index], decoration: InputDecoration(labelText: 'الخيار ${String.fromCharCode(65 + index)}')),
          )),
          DropdownButtonFormField<int>(
            initialValue: correctIndex, decoration: const InputDecoration(labelText: 'الإجابة الصحيحة'),
            items: List.generate(4, (index) => DropdownMenuItem(value: index, child: Text('الخيار ${String.fromCharCode(65 + index)}'))),
            onChanged: (value) { if (value != null) setDialogState(() => correctIndex = value); },
          ),
        ]))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
          FilledButton(onPressed: () {
            final options = optionControllers.map((c) => c.text.trim()).toList();
            if (title.text.trim().isEmpty || question.text.trim().isEmpty || options.any((o) => o.isEmpty)) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أكمل اسم الاختبار والسؤال والخيارات الأربعة.')));
              return;
            }
            Navigator.pop(context, {'title': title.text.trim(), 'question': question.text.trim(), 'options': options, 'correctIndex': correctIndex});
          }, child: const Text('حفظ الاختبار')),
        ],
      )),
    );
    title.dispose(); question.dispose();
    for (final controller in optionControllers) { controller.dispose(); }
    if (result == null || !mounted) return;
    try {
      final options = List<String>.from(result['options'] as List);
      final questionData = <String, dynamic>{
        'id': 'q1',
        'question': result['question'],
        'type': 'multiple_choice',
        'options': options,
        'correctAnswer': options[result['correctIndex'] as int],
      };
      final ref = await FirebaseFirestore.instance.collection('studentTests').add({
        'ownerId': user.uid,
        'title': result['title'],
        'questions': [questionData],
        'durationMinutes': 0,
        'passingScore': 100,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تم حفظ الاختبار. رقم الاختبار: ${ref.id}')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }
}

class _PublicTests extends StatelessWidget {
  const _PublicTests();
  @override
  Widget build(BuildContext context) => FutureBuilder<QuerySnapshot<Map<String, dynamic>>>(
    future: FirebaseFirestore.instance.collection('tests').where('active', isEqualTo: true).limit(30).get(),
    builder: (context, snapshot) {
      if (snapshot.hasError) return Text(firebaseErrorMessage(snapshot.error!));
      if (!snapshot.hasData) return const LinearProgressIndicator();
      final tests = snapshot.data!.docs;
      if (tests.isEmpty) return const Text('لا توجد اختبارات منشورة متاحة حاليًا.');
      return Column(children: tests.map((doc) {
        final data = doc.data();
        final title = (data['title'] ?? data['name'] ?? 'اختبار').toString();
        final questions = data['questions'];
        return Card(margin: const EdgeInsets.only(bottom: 9), child: ListTile(
          leading: const CircleAvatar(child: Icon(Icons.assignment_outlined)),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text((data['description'] ?? (questions is List ? '${questions.length} سؤال' : 'تدريب منشور')).toString()),
          trailing: const Icon(Icons.chevron_left_rounded),
          onTap: questions is List && questions.isNotEmpty
            ? () => _openRunner(context, title, questions)
            : () => showDialog<void>(context: context, builder: (ctx) => AlertDialog(
                title: Text(title), content: const Text('هذا الاختبار منشور في البيانات القديمة، لكن شكل أسئلته لا يمكن تشغيله تلقائيًا في شاشة التدريب الحالية.'),
                actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إغلاق'))],
              )),
        ));
      }).toList());
    },
  );

  void _openRunner(BuildContext context, String title, List<dynamic> questions) {
    showDialog<void>(context: context, builder: (_) => QuizRunner(title: title, questions: questions));
  }
}

class _MyTests extends StatefulWidget {
  const _MyTests({required this.user});
  final User user;
  @override
  State<_MyTests> createState() => _MyTestsState();
}

class _MyTestsState extends State<_MyTests> {
  Future<void> _shareTest(String testId, Map<String, dynamic> data) async {
    final questions = data['questions'];
    if (questions is! List || questions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('هذا الاختبار لا يحتوي على أسئلة قابلة للمشاركة.')));
      return;
    }
    try {
      final db = FirebaseFirestore.instance;
      final shareRef = db.collection('studentTestShares').doc(testId);
      await shareRef.set({
        'ownerId': widget.user.uid,
        'testId': testId,
        'title': (data['title'] ?? 'اختبار تدريبي').toString(),
        'questions': questions,
        'durationMinutes': data['durationMinutes'] ?? 0,
        'passingScore': data['passingScore'] ?? 0,
        'updatedAt': FieldValue.serverTimestamp(),
        'createdAt': FieldValue.serverTimestamp(),
      });
      if (!mounted) return;
      final link = Uri.base.replace(fragment: '/tests/shared/$testId').toString();
      await showDialog<void>(context: context, builder: (dialogContext) => AlertDialog(
        title: const Text('رابط الاختبار جاهز'),
        content: SelectableText(link, style: const TextStyle(height: 1.6)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إغلاق')),
          FilledButton.icon(onPressed: () async {
            await Clipboard.setData(ClipboardData(text: link));
            if (dialogContext.mounted) Navigator.pop(dialogContext);
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم نسخ الرابط.')));
          }, icon: const Icon(Icons.copy_rounded), label: const Text('نسخ الرابط')),
        ],
      ));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<QuerySnapshot<Map<String, dynamic>>>(
    future: FirebaseFirestore.instance.collection('studentTests').where('ownerId', isEqualTo: widget.user.uid).limit(50).get(),
    builder: (context, snapshot) {
      if (snapshot.hasError) return Text(firebaseErrorMessage(snapshot.error!));
      if (!snapshot.hasData) return const LinearProgressIndicator();
      final docs = snapshot.data!.docs;
      if (docs.isEmpty) return const Text('ما أنشأت اختبارات بعد.');
      return Column(children: docs.map((doc) {
        final data = doc.data();
        final questions = data['questions'];
        return Card(margin: const EdgeInsets.only(bottom: 9), child: ListTile(
          leading: const CircleAvatar(child: Icon(Icons.quiz_rounded)),
          title: Text((data['title'] ?? 'اختبار شخصي').toString(), style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${questions is List ? questions.length : 0} سؤال'),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(tooltip: 'مشاركة الاختبار', onPressed: questions is List && questions.isNotEmpty ? () => _shareTest(doc.id, data) : null,
              icon: const Icon(Icons.share_outlined)),
            const Icon(Icons.play_arrow_rounded),
          ]),
          onTap: questions is List && questions.isNotEmpty ? () => showDialog<void>(context: context, builder: (_) => QuizRunner(title: (data['title'] ?? 'اختبار').toString(), questions: questions)) : null,
        ));
      }).toList());
    },
  );
}

class QuizRunner extends StatefulWidget {
  const QuizRunner({super.key, required this.title, required this.questions});
  final String title;
  final List<dynamic> questions;
  @override
  State<QuizRunner> createState() => _QuizRunnerState();
}
class _QuizRunnerState extends State<QuizRunner> {
  final Map<int, String> _answers = {};
  bool _finished = false;
  int _score = 0;

  String _questionText(dynamic value) {
    if (value is Map) return (value['question'] ?? value['text'] ?? '').toString();
    return value?.toString() ?? '';
  }
  List<String> _options(dynamic value) {
    if (value is Map && value['options'] is List) return (value['options'] as List).map((x) => x.toString()).toList();
    return const [];
  }
  String _correct(dynamic value) {
    if (value is Map) return (value['correctAnswer'] ?? value['answer'] ?? value['correctOption'] ?? '').toString();
    return '';
  }
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(_finished ? 'نتيجة الاختبار' : widget.title),
    content: SizedBox(width: 540, child: SingleChildScrollView(child: _finished
      ? Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.emoji_events_outlined, size: 46, color: Color(0xFF0F766E)),
          const SizedBox(height: 12),
          Text('نتيجتك: $_score من ${widget.questions.length}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
          const SizedBox(height: 8),
          const Text('هذه النتيجة محلية في جلسة التدريب وليست سجل علامة رسميًا.'),
        ])
      : Column(mainAxisSize: MainAxisSize.min, children: List.generate(widget.questions.length, (index) {
          final item = widget.questions[index];
          final options = _options(item);
          return Padding(padding: const EdgeInsets.only(bottom: 18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('السؤال ${index + 1}', style: const TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.w800)),
            const SizedBox(height: 7),
            Text(_questionText(item), style: const TextStyle(height: 1.6)),
            if (options.isEmpty) const Padding(padding: EdgeInsets.only(top: 6), child: Text('نوع السؤال غير مدعوم في شاشة التدريب الحالية.')),
            if (options.isNotEmpty) RadioGroup<String>(
              groupValue: _answers[index],
              onChanged: (value) {
                if (value != null) setState(() => _answers[index] = value);
              },
              child: Column(children: options.map((option) => RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                value: option,
                title: Text(option),
              )).toList()),
            ),
          ]));
        })))),
    actions: _finished ? [FilledButton(onPressed: () => Navigator.pop(context), child: const Text('إغلاق'))]
      : [TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
          FilledButton(onPressed: () {
            var score = 0;
            for (var i = 0; i < widget.questions.length; i++) {
              final correct = _correct(widget.questions[i]);
              if (correct.isNotEmpty && _answers[i] == correct) score++;
            }
            setState(() { _score = score; _finished = true; });
          }, child: const Text('إنهاء وتصحيح'))],
  );
}
