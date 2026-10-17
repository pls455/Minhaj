import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/ai/ai_service.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/widgets/async_state.dart';

class AssistantPage extends StatefulWidget {
  const AssistantPage({super.key});
  @override
  State<AssistantPage> createState() => _AssistantPageState();
}

class _AssistantPageState extends State<AssistantPage> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<_Message> _messages = [
    const _Message('اسأل عن مفهوم دراسي أو اطلب شرح خطوة في مسألة. عندما تكون المعلومة غير متاحة، يجب توضيح ذلك بدل اختراع إجابة.', false),
  ];
  bool _sending = false;
  int? _remaining;
  DateTime? _resetAt;
  String? _error;

  @override
  void dispose() { _input.dispose(); _scroll.dispose(); super.dispose(); }

  Future<_Quota> _reserve(User user) async {
    final ref = FirebaseFirestore.instance.collection('studentAiUsage').doc(user.uid);
    return FirebaseFirestore.instance.runTransaction<_Quota>((transaction) async {
      final snapshot = await transaction.get(ref);
      final now = DateTime.now();
      final data = snapshot.data();
      final timestamp = data?['windowStartedAt'];
      final started = timestamp is Timestamp ? timestamp.toDate() : null;
      final expired = started == null || now.difference(started) >= const Duration(days: 3);
      final used = expired ? 0 : ((data?['count'] as num?)?.toInt() ?? 0);
      if (used >= 3) return _Quota(allowed: false, remaining: 0, resetAt: started!.add(const Duration(days: 3)));
      final next = used + 1;
      transaction.set(ref, {
        'count': next,
        'windowStartedAt': expired ? FieldValue.serverTimestamp() : timestamp,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return _Quota(allowed: true, remaining: 3 - next, resetAt: (expired ? now : started!).add(const Duration(days: 3)));
    });
  }

  Future<void> _send() async {
    final question = _input.text.trim();
    if (question.isEmpty || _sending) return;
    if (!AuthService.isReady) {
      setState(() => _error = 'خدمة الحسابات غير مهيأة في هذه النسخة.');
      return;
    }
    final user = AuthService.currentUser;
    if (user == null) {
      setState(() => _error = 'سجّل الدخول لاستخدام مساعد منهاج.');
      return;
    }
    _input.clear();
    setState(() { _sending = true; _error = null; _messages.add(_Message(question, true)); });
    _scrollToEnd();
    try {
      final quota = await _reserve(user);
      if (!quota.allowed) {
        setState(() { _remaining = 0; _resetAt = quota.resetAt; _messages.add(_Message('وصلت إلى الحد المجاني: 3 أسئلة خلال 3 أيام. يتجدد الحد في ' + _formatDate(quota.resetAt) + '.', false)); });
        return;
      }
      setState(() { _remaining = quota.remaining; _resetAt = quota.resetAt; });
      final answer = await AiService.ask(question);
      if (mounted) setState(() => _messages.add(_Message(answer, false)));
    } catch (error) {
      if (mounted) setState(() {
        _error = firebaseErrorMessage(error);
        _messages.add(_Message(_error!, false));
      });
    } finally {
      if (mounted) { setState(() => _sending = false); _scrollToEnd(); }
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
    });
  }

  String _formatDate(DateTime date) => date.year.toString() + '/' + date.month.toString().padLeft(2, '0') + '/' + date.day.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isReady) return const AsyncStateView(icon: Icons.auto_awesome_outlined, message: 'مساعد منهاج يحتاج إعداد Firebase. إعداد رابط المساعد موجود من خلال متغير MINHAJ_AI_URL، ولا توضع مفاتيح النموذج داخل التطبيق.');
    if (AuthService.currentUser == null) return Center(child: Padding(
      padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.auto_awesome_rounded, size: 44, color: Color(0xFF0F766E)),
        const SizedBox(height: 12), const Text('للاستخدام العادل وحفظ حد الأسئلة، سجّل الدخول أولًا.', textAlign: TextAlign.center),
        const SizedBox(height: 12), FilledButton(onPressed: () => context.go('/profile'), child: const Text('تسجيل الدخول')),
      ]),
    ));
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 8), child: Row(children: [
        const Icon(Icons.auto_awesome_rounded, color: Color(0xFF0F766E)),
        const SizedBox(width: 8),
        const Expanded(child: Text('مساعد منهاج', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18))),
        if (_remaining != null) Text('متبقي ' + _remaining.toString() + '/3', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
      ])),
      if (_resetAt != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Text('يتجدد الحد في ' + _formatDate(_resetAt!), style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
      )),
      Expanded(child: ListView.builder(
        controller: _scroll, padding: const EdgeInsets.all(16),
        itemCount: _messages.length + (_sending ? 1 : 0),
        itemBuilder: (context, index) {
          if (_sending && index == _messages.length) return const Align(alignment: AlignmentDirectional.centerStart, child: Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Card(child: Padding(padding: EdgeInsets.all(14), child: Row(mainAxisSize: MainAxisSize.min, children: [
              SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)), SizedBox(width: 10), Text('جارٍ التفكير...'),
            ]))),
          ));
          final message = _messages[index];
          return Align(
            alignment: message.isUser ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 760),
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: message.isUser ? const Color(0xFFE6F4F1) : Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE5EAF2)),
              ),
              child: SelectableText(message.text, style: const TextStyle(height: 1.7)),
            ),
          );
        },
      )),
      SafeArea(top: false, child: Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 12), child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(child: TextField(
          controller: _input, maxLength: 3000, minLines: 1, maxLines: 4,
          onSubmitted: (_) => _send(),
          decoration: const InputDecoration(counterText: '', hintText: 'اكتب سؤالك الدراسي...'),
        )),
        const SizedBox(width: 8),
        IconButton.filled(onPressed: _sending ? null : _send, icon: const Icon(Icons.send_rounded), tooltip: 'إرسال السؤال'),
      ]))),
    ]);
  }
}

class _Message {
  const _Message(this.text, this.isUser);
  final String text;
  final bool isUser;
}
class _Quota {
  const _Quota({required this.allowed, required this.remaining, required this.resetAt});
  final bool allowed;
  final int remaining;
  final DateTime resetAt;
}
