import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/data/study_repository.dart';
import '../../../core/widgets/async_state.dart';

class SuggestionsPage extends StatefulWidget {
  const SuggestionsPage({super.key});
  @override
  State<SuggestionsPage> createState() => _SuggestionsPageState();
}

class _SuggestionsPageState extends State<SuggestionsPage> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController(), _url = TextEditingController();
  final _description = TextEditingController(), _keywords = TextEditingController();
  List<Map<String, dynamic>> _branches = [], _subjects = [];
  String? _branchId, _subjectId;
  bool _loading = true, _sending = false;
  String? _error, _success;

  @override
  void initState() { super.initState(); _loadCatalog(); }
  Future<void> _loadCatalog() async {
    try {
      final data = await Future.wait([
        StudyRepository.listCatalog('branches', limit: 30),
        StudyRepository.listCatalog('subjects', limit: 80),
      ]);
      if (mounted) setState(() { _branches = data[0]; _subjects = data[1]; _loading = false; });
    } catch (error) {
      if (mounted) setState(() { _error = firebaseErrorMessage(error); _loading = false; });
    }
  }
  @override
  void dispose() { _title.dispose(); _url.dispose(); _description.dispose(); _keywords.dispose(); super.dispose(); }

  Future<void> _submit(User user) async {
    if (!_formKey.currentState!.validate()) return;
    if (_branchId == null || _subjectId == null) {
      setState(() => _error = 'اختَر الفرع والمادة أولًا.');
      return;
    }
    setState(() { _sending = true; _error = null; _success = null; });
    try {
      final profile = await AuthService.getProfile(user.uid);
      final name = (profile?['name'] ?? user.displayName ?? user.email?.split('@').first ?? 'طالب').toString();
      final url = _url.text.trim();
      final uri = Uri.tryParse(url);
      if (uri == null || !['http', 'https'].contains(uri.scheme) || uri.host.isEmpty) {
        throw ArgumentError('الرابط يجب أن يبدأ بـ https:// أو http://');
      }
      final words = _keywords.text.split(',').map((item) => item.trim()).where((item) => item.isNotEmpty).take(20).toList();
      await FirebaseFirestore.instance.collection('suggestions').add({
        'title': _title.text.trim(),
        'contentType': 'resource',
        'studentName': name.length > 80 ? name.substring(0, 80) : name,
        'url': url,
        'branchId': _branchId,
        'subjectId': _subjectId,
        'type': 'link',
        'description': _description.text.trim(),
        'keywords': words,
        'status': 'pending',
        'studentUid': user.uid,
        'studentEmail': user.email ?? '',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      if (!mounted) return;
      _title.clear(); _url.clear(); _description.clear(); _keywords.clear();
      setState(() => _success = 'وصل اقتراحك إلى قائمة المراجعة. سيظهر للطلاب بعد اعتماده ونشره.');
    } catch (error) {
      if (mounted) setState(() => _error = firebaseErrorMessage(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!StudyRepository.isReady) return const AsyncStateView(icon: Icons.lightbulb_outline_rounded, message: 'إرسال الاقتراحات يحتاج إعداد Firebase في نسخة التطبيق.');
    final user = AuthService.currentUser;
    if (user == null) return Center(child: Padding(
      padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.lightbulb_outline_rounded, size: 42, color: Color(0xFF0F766E)),
        const SizedBox(height: 12), const Text('سجّل الدخول حتى نربط الاقتراح باسم حسابك ونمنع الإرسال المجهول للمصادر.', textAlign: TextAlign.center),
        const SizedBox(height: 12), FilledButton(onPressed: () => context.go('/profile'), child: const Text('تسجيل الدخول')),
      ]),
    ));
    if (_loading) return const Center(child: CircularProgressIndicator());
    return ListView(padding: const EdgeInsets.all(20), children: [
      Text('اقترح مصدرًا', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      const Text('أرسل رابطًا تعليميًا مناسبًا للتوجيهي. سيبقى الاقتراح قيد المراجعة حتى يراجعه الفريق.'),
      const SizedBox(height: 18),
      Card(child: Padding(padding: const EdgeInsets.all(18), child: Form(key: _formKey, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        TextFormField(controller: _title, maxLength: 200, decoration: const InputDecoration(labelText: 'عنوان المصدر'), validator: (v) => (v == null || v.trim().isEmpty) ? 'العنوان مطلوب' : null),
        const SizedBox(height: 10),
        TextFormField(controller: _url, keyboardType: TextInputType.url, decoration: const InputDecoration(labelText: 'رابط المصدر'), validator: (v) => (v == null || !v.trim().contains('.')) ? 'أدخل رابطًا صحيحًا' : null),
        const SizedBox(height: 10),
        TextFormField(controller: _description, maxLength: 1000, maxLines: 3, decoration: const InputDecoration(labelText: 'وصف مختصر')),
        const SizedBox(height: 10),
        TextFormField(controller: _keywords, decoration: const InputDecoration(labelText: 'كلمات مفتاحية (افصل بينها بفواصل)')),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          value: _branches.any((item) => item['id'] == _branchId) ? _branchId : null,
          isExpanded: true, decoration: const InputDecoration(labelText: 'الفرع'),
          items: _branches.map((item) => DropdownMenuItem(value: item['id'].toString(), child: Text((item['name'] ?? 'فرع').toString()))).toList(),
          onChanged: (value) => setState(() { _branchId = value; _subjectId = null; }),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          value: _subjects.any((item) => item['id'] == _subjectId) ? _subjectId : null,
          isExpanded: true, decoration: const InputDecoration(labelText: 'المادة'),
          items: _subjects.where((item) => _branchId == null ||
            ((item['branchIds'] is List && (item['branchIds'] as List).map((e) => '$e').contains(_branchId)) || (item['branchId'] ?? '').toString() == _branchId))
            .map((item) => DropdownMenuItem(value: item['id'].toString(), child: Text((item['name'] ?? 'مادة').toString()))).toList(),
          onChanged: (value) => setState(() => _subjectId = value),
        ),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C)))),
        if (_success != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_success!, style: const TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.w700))),
        const SizedBox(height: 14),
        FilledButton.icon(onPressed: _sending ? null : () => _submit(user), icon: const Icon(Icons.send_rounded),
          label: Text(_sending ? 'جارٍ الإرسال...' : 'إرسال للمراجعة')),
      ])))),
      const SizedBox(height: 18),
      StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance.collection('suggestions').where('studentUid', isEqualTo: user.uid).limit(30).snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return Text(firebaseErrorMessage(snapshot.error!));
          if (!snapshot.hasData || snapshot.data!.docs.isEmpty) return const SizedBox.shrink();
          final rows = snapshot.data!.docs;
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('اقتراحاتك السابقة', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            ...rows.map((doc) => Card(child: ListTile(
              title: Text((doc.data()['title'] ?? 'مصدر').toString()),
              subtitle: Text('الحالة: ' + (doc.data()['status'] ?? 'pending').toString()),
              leading: const Icon(Icons.history_rounded),
            ))),
          ]);
        },
      ),
    ]);
  }
}
