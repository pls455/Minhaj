import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/data/study_repository.dart';
import '../../../core/widgets/async_state.dart';

class AdminPage extends StatelessWidget {
  const AdminPage({super.key});

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isReady) return const AsyncStateView(icon: Icons.admin_panel_settings_outlined, message: 'لوحة الإدارة تحتاج إعداد Firebase في نسخة التطبيق.');
    final user = AuthService.currentUser;
    if (user == null) return Center(child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.lock_outline_rounded, size: 42),
        const SizedBox(height: 12),
        const Text('سجّل الدخول أولًا. لن تُمنح صلاحيات الإدارة إلا للحسابات المعتمدة في قاعدة البيانات.', textAlign: TextAlign.center),
        const SizedBox(height: 12),
        FilledButton(onPressed: () => context.go('/profile'), child: const Text('تسجيل الدخول')),
      ]),
    ));
    return FutureBuilder<Map<String, dynamic>?>(
      future: StudyRepository.getAdmin(user.uid),
      builder: (context, snapshot) {
        if (!snapshot.hasData && !snapshot.hasError) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return AsyncStateView(message: firebaseErrorMessage(snapshot.error!));
        final admin = snapshot.data;
        final role = (admin?['role'] ?? '').toString().toLowerCase();
        final active = admin?['active'] == true;
        final canReview = active && ['reviewer', 'content_admin', 'super_admin', 'superadmin', 'admin'].contains(role);
        final canEdit = active && ['content_admin', 'super_admin', 'superadmin', 'admin'].contains(role);
        if (!canReview) return const AsyncStateView(
          icon: Icons.no_accounts_rounded,
          message: 'هذا الحساب غير مسجل كمشرف نشط. تتم إدارة الصلاحيات من سجل admins في Firestore، ولا يمكن إنشاء صلاحية لنفسك من التطبيق.',
        );
        return ListView(padding: const EdgeInsets.all(20), children: [
          Text('لوحة الإدارة', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('الدور الحالي: ' + role),
          const SizedBox(height: 16),
          if (canEdit) _ResourceManager(admin: admin!, user: user),
          const SizedBox(height: 22),
          _ReviewQueue(admin: admin!, user: user),
        ]);
      },
    );
  }
}

class _ResourceManager extends StatefulWidget {
  const _ResourceManager({required this.admin, required this.user});
  final Map<String, dynamic> admin;
  final User user;
  @override
  State<_ResourceManager> createState() => _ResourceManagerState();
}
class _ResourceManagerState extends State<_ResourceManager> {
  List<Map<String, dynamic>> _branches = [], _subjects = [];
  bool _catalogLoading = true;
  String? _error;
  @override
  void initState() { super.initState(); _loadCatalog(); }

  Future<void> _loadCatalog() async {
    try {
      final result = await Future.wait([
        StudyRepository.listCatalog('branches', limit: 50),
        StudyRepository.listCatalog('subjects', limit: 100),
      ]);
      if (mounted) setState(() { _branches = result[0]; _subjects = result[1]; _catalogLoading = false; });
    } catch (error) {
      if (mounted) setState(() { _error = firebaseErrorMessage(error); _catalogLoading = false; });
    }
  }

  Future<void> _edit({Map<String, dynamic>? item}) async {
    if (_catalogLoading) return;
    if (_branches.isEmpty || _subjects.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أضف الفروع والمواد أولًا من أدوات الإدارة الحالية.')));
      return;
    }
    final result = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (context) => _ResourceEditorDialog(branches: _branches, subjects: _subjects, initial: item),
    );
    if (result == null || !mounted) return;
    try {
      final db = FirebaseFirestore.instance;
      final payload = <String, dynamic>{
        ...result,
        'updatedAt': FieldValue.serverTimestamp(),
      };
      if (item == null) {
        payload['createdAt'] = FieldValue.serverTimestamp();
        payload['createdBy'] = widget.user.uid;
        await db.collection('resources').add(payload);
      } else {
        await db.collection('resources').doc(item['id'].toString()).update(payload);
      }
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ المصدر.')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }

  Future<void> _deactivate(Map<String, dynamic> item) async {
    final ok = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('إخفاء المصدر؟'),
      content: const Text('سيُخفى المصدر عن الطلاب مع إبقاء سجله في قاعدة البيانات. يمكنك إعادة تفعيله لاحقًا من أدوات الإدارة.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('إخفاء')),
      ],
    ));
    if (ok != true) return;
    try {
      await FirebaseFirestore.instance.collection('resources').doc(item['id'].toString())
        .update({'active': false, 'updatedAt': FieldValue.serverTimestamp()});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إخفاء المصدر دون حذفه.')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Expanded(child: Text('إدارة المصادر', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18))),
        FilledButton.icon(onPressed: _catalogLoading ? null : () => _edit(), icon: const Icon(Icons.add_rounded), label: const Text('إضافة')),
      ]),
      const SizedBox(height: 6),
      const Text('إضافة المصادر وتعديل بياناتها أو إخفاؤها مع الحفاظ على السجل.'),
      if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C)))),
      if (_catalogLoading) const Padding(padding: EdgeInsets.all(14), child: Center(child: CircularProgressIndicator())),
      if (!_catalogLoading) StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance.collection('resources').orderBy('order').limit(30).snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return Padding(padding: const EdgeInsets.all(12), child: Text(firebaseErrorMessage(snapshot.error!)));
          if (!snapshot.hasData) return const Padding(padding: EdgeInsets.all(12), child: LinearProgressIndicator());
          final docs = snapshot.data!.docs;
          if (docs.isEmpty) return const Padding(padding: EdgeInsets.all(12), child: Text('لا توجد مصادر في المجموعة الحالية.'));
          return Column(children: docs.map((doc) {
            final data = doc.data();
            final active = data['active'] != false;
            final item = <String, dynamic>{'id': doc.id, ...data};
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(active ? Icons.link_rounded : Icons.link_off_rounded, color: active ? const Color(0xFF0F766E) : const Color(0xFF94A3B8)),
              title: Text((data['title'] ?? 'مصدر').toString(), maxLines: 2, overflow: TextOverflow.ellipsis),
              subtitle: Text(active ? (data['url'] ?? '').toString() : 'مخفي عن الطلاب'),
              trailing: PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'edit') _edit(item: item);
                  if (value == 'hide' && active) _deactivate(item);
                  if (value == 'show' && !active) _reactivate(item);
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(value: 'edit', child: Text('تعديل')),
                  PopupMenuItem(value: active ? 'hide' : 'show', child: Text(active ? 'إخفاء' : 'إعادة النشر')),
                ],
              ),
            );
          }).toList());
        },
      ),
    ])),
  );

  Future<void> _reactivate(Map<String, dynamic> item) async {
    try {
      await FirebaseFirestore.instance.collection('resources').doc(item['id'].toString())
        .update({'active': true, 'updatedAt': FieldValue.serverTimestamp()});
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }
}

class _ResourceEditorDialog extends StatefulWidget {
  const _ResourceEditorDialog({required this.branches, required this.subjects, this.initial});
  final List<Map<String, dynamic>> branches, subjects;
  final Map<String, dynamic>? initial;
  @override
  State<_ResourceEditorDialog> createState() => _ResourceEditorDialogState();
}
class _ResourceEditorDialogState extends State<_ResourceEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _title, _url, _description, _keywords, _author;
  String? _branchId, _subjectId;
  String _type = 'link';
  bool _active = true;
  @override
  void initState() {
    super.initState();
    final data = widget.initial ?? {};
    _title = TextEditingController(text: (data['title'] ?? '').toString());
    _url = TextEditingController(text: (data['url'] ?? '').toString());
    _description = TextEditingController(text: (data['description'] ?? '').toString());
    _keywords = TextEditingController(text: data['keywords'] is List ? (data['keywords'] as List).join(', ') : '');
    _author = TextEditingController(text: (data['author'] ?? '').toString());
    final branchIds = data['branchIds'] is List ? (data['branchIds'] as List).map((e) => '$e').toList() : <String>[];
    _branchId = widget.branches.any((b) => b['id'] == (data['branchId'] ?? branchIds.firstOrNull)) ? (data['branchId'] ?? branchIds.firstOrNull)?.toString() : widget.branches.first['id'].toString();
    _subjectId = widget.subjects.any((s) => s['id'] == data['subjectId']) ? data['subjectId'].toString() : widget.subjects.first['id'].toString();
    _type = (data['type'] ?? 'link').toString();
    if (!['link', 'pdf', 'video', 'document', 'exam'].contains(_type)) _type = 'link';
    _active = data['active'] != false;
  }
  @override
  void dispose() { _title.dispose(); _url.dispose(); _description.dispose(); _keywords.dispose(); _author.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.initial == null ? 'إضافة مصدر' : 'تعديل المصدر'),
    content: SizedBox(width: 520, child: SingleChildScrollView(child: Form(
      key: _formKey,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextFormField(controller: _title, maxLength: 200, decoration: const InputDecoration(labelText: 'العنوان'), validator: (v) => (v == null || v.trim().isEmpty) ? 'العنوان مطلوب' : null),
        const SizedBox(height: 8),
        TextFormField(controller: _url, maxLines: 2, keyboardType: TextInputType.url, decoration: const InputDecoration(labelText: 'الرابط'), validator: (v) {
          final uri = Uri.tryParse((v ?? '').trim());
          return uri == null || !['http', 'https'].contains(uri.scheme) || uri.host.isEmpty ? 'أدخل رابط http أو https صالحًا' : null;
        }),
        const SizedBox(height: 8),
        TextFormField(controller: _description, maxLength: 5000, maxLines: 3, decoration: const InputDecoration(labelText: 'الوصف')),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(value: _branchId, isExpanded: true, decoration: const InputDecoration(labelText: 'الفرع'),
          items: widget.branches.map((b) => DropdownMenuItem(value: b['id'].toString(), child: Text((b['name'] ?? 'فرع').toString()))).toList(),
          onChanged: (v) => setState(() { _branchId = v; final compatible = widget.subjects.where((s) => v == null || ((s['branchIds'] is List && (s['branchIds'] as List).map((e) => '$e').contains(v)) || (s['branchId'] ?? '').toString() == v)).toList(); if (compatible.isNotEmpty && !compatible.any((s) => s['id'] == _subjectId)) _subjectId = compatible.first['id'].toString(); })),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(value: _subjectId, isExpanded: true, decoration: const InputDecoration(labelText: 'المادة'),
          items: widget.subjects.where((s) => _branchId == null || ((s['branchIds'] is List && (s['branchIds'] as List).map((e) => '$e').contains(_branchId)) || (s['branchId'] ?? '').toString() == _branchId))
            .map((s) => DropdownMenuItem(value: s['id'].toString(), child: Text((s['name'] ?? 'مادة').toString()))).toList(),
          onChanged: (v) => setState(() => _subjectId = v)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(value: _type, decoration: const InputDecoration(labelText: 'نوع المصدر'),
          items: const [DropdownMenuItem(value: 'link', child: Text('رابط')), DropdownMenuItem(value: 'pdf', child: Text('PDF')), DropdownMenuItem(value: 'video', child: Text('فيديو')), DropdownMenuItem(value: 'document', child: Text('ملف / مستند')), DropdownMenuItem(value: 'exam', child: Text('امتحان'))],
          onChanged: (v) => setState(() => _type = v ?? 'link')),
        const SizedBox(height: 8),
        TextFormField(controller: _author, decoration: const InputDecoration(labelText: 'المعلم أو المصدر (اختياري)')),
        const SizedBox(height: 8),
        TextFormField(controller: _keywords, decoration: const InputDecoration(labelText: 'كلمات مفتاحية بفواصل')),
        SwitchListTile(value: _active, onChanged: (v) => setState(() => _active = v), title: const Text('منشور للطلاب'), contentPadding: EdgeInsets.zero),
      ]),
    ))),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
      FilledButton(onPressed: () {
        if (!_formKey.currentState!.validate() || _branchId == null || _subjectId == null) return;
        final keywords = _keywords.text.split(',').map((v) => v.trim()).where((v) => v.isNotEmpty).take(100).toSet().toList();
        Navigator.pop(context, {
          'title': _title.text.trim(), 'url': _url.text.trim(), 'description': _description.text.trim(),
          'branchIds': [_branchId], 'branchId': _branchId, 'subjectId': _subjectId, 'categoryId': (widget.initial?['categoryId'] ?? '').toString(),
          'type': _type, 'author': _author.text.trim(), 'keywords': keywords, 'tags': <String>[],
          'order': (widget.initial?['order'] as num?)?.toInt() ?? 0, 'active': _active,
        });
      }, child: const Text('حفظ')),
    ],
  );
}

class _ReviewQueue extends StatefulWidget {
  const _ReviewQueue({required this.admin, required this.user});
  final Map<String, dynamic> admin;
  final User user;
  @override
  State<_ReviewQueue> createState() => _ReviewQueueState();
}
class _ReviewQueueState extends State<_ReviewQueue> {
  late Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> _future;
  @override
  void initState() { super.initState(); _future = _load(); }
  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> _load() async {
    final snapshot = await FirebaseFirestore.instance.collection('suggestions').where('status', isEqualTo: 'pending').limit(50).get();
    return snapshot.docs;
  }
  Future<void> _review(QueryDocumentSnapshot<Map<String, dynamic>> doc, String status) async {
    try {
      await doc.reference.update({'status': status, 'reviewedBy': widget.user.uid, 'updatedAt': FieldValue.serverTimestamp()});
      if (mounted) setState(() => _future = _load());
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Row(children: [
      const Expanded(child: Text('اقتراحات قيد المراجعة', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18))),
      IconButton(tooltip: 'تحديث', onPressed: () => setState(() => _future = _load()), icon: const Icon(Icons.refresh_rounded)),
    ]),
    FutureBuilder<List<QueryDocumentSnapshot<Map<String, dynamic>>>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.hasError) return Text(firebaseErrorMessage(snapshot.error!));
        if (!snapshot.hasData) return const Padding(padding: EdgeInsets.all(12), child: LinearProgressIndicator());
        final docs = snapshot.data!;
        if (docs.isEmpty) return const Padding(padding: EdgeInsets.all(10), child: Text('قائمة المراجعة فارغة حاليًا.'));
        return Column(children: docs.map((doc) {
          final data = doc.data();
          return ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text((data['title'] ?? 'اقتراح').toString()),
            subtitle: Text((data['description'] ?? data['url'] ?? '').toString(), maxLines: 2, overflow: TextOverflow.ellipsis),
            trailing: PopupMenuButton<String>(
              onSelected: (value) => _review(doc, value),
              itemBuilder: (context) => const [
                PopupMenuItem(value: 'approved', child: Text('اعتماد')),
                PopupMenuItem(value: 'rejected', child: Text('رفض')),
              ],
            ),
          );
        }).toList());
      },
    ),
  ])));
}
