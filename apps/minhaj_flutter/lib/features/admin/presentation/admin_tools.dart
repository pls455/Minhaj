import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../core/data/study_repository.dart';
import '../../../core/widgets/async_state.dart';

class AdminTools extends StatelessWidget {
  const AdminTools({super.key, required this.user, required this.role});
  final User user;
  final String role;

  bool get _isSuperAdmin => const {'super_admin', 'superadmin', 'admin'}.contains(role);
  bool get _canEditContent => const {'content_admin', 'super_admin', 'superadmin', 'admin'}.contains(role);
  bool get _canReview => const {'reviewer', 'content_admin', 'super_admin', 'superadmin', 'admin'}.contains(role);

  @override
  Widget build(BuildContext context) => Column(children: [
    if (_canReview) SourceRegistryManager(user: user),
    if (_canEditContent) StudyContentManager(collectionName: 'curriculumUnits', title: 'إدارة الوحدات الدراسية', user: user, role: role),
    if (_canEditContent) StudyContentManager(collectionName: 'foundations', title: 'إدارة التأسيس', user: user, role: role),
    if (_canEditContent) StudyContentManager(collectionName: 'solutions', title: 'إدارة الحلول', user: user, role: role),
    if (_isSuperAdmin) AdminUsersManager(user: user, currentRole: role),
    if (_isSuperAdmin) StudentDirectoryManager(),
    if (_isSuperAdmin) const AdminLogsManager(),
  ]);
}

class AdminUsersManager extends StatefulWidget {
  const AdminUsersManager({super.key, required this.user, required this.currentRole});
  final User user;
  final String currentRole;
  @override
  State<AdminUsersManager> createState() => _AdminUsersManagerState();
}
class _AdminUsersManagerState extends State<AdminUsersManager> {
  Future<void> _edit({Map<String, dynamic>? admin}) async {
    final result = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (context) => _AdminEditor(initial: admin),
    );
    if (result == null || !mounted) return;
    final uid = (result['uid'] ?? '').toString().trim();
    final email = (result['email'] ?? '').toString().trim();
    final newRole = (result['role'] ?? '').toString();
    final active = result['active'] == true;
    if (uid.isEmpty || uid.length > 128 || email.isEmpty || !email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تحقّق من UID والبريد الإلكتروني.')));
      return;
    }
    try {
      final db = FirebaseFirestore.instance;
      final ref = db.collection('admins').doc(uid);
      final existing = await ref.get();
      final batch = db.batch();
      final payload = <String, dynamic>{
        'email': email,
        'role': newRole,
        'active': active,
        'updatedAt': FieldValue.serverTimestamp(),
      };
      if (existing.exists) {
        batch.update(ref, payload);
      } else {
        payload['createdAt'] = FieldValue.serverTimestamp();
        batch.set(ref, payload);
      }
      final logRef = db.collection('adminLogs').doc();
      batch.set(logRef, {
        'adminUid': widget.user.uid,
        'adminEmail': widget.user.email ?? '',
        'role': widget.currentRole,
        'action': existing.exists ? 'update_admin' : 'create_admin',
        'collection': 'admins',
        'targetId': uid,
        'details': 'role=$newRole; active=$active',
        'timestamp': FieldValue.serverTimestamp(),
      });
      await batch.commit();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ حساب الإدارة.')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 14),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Text('حسابات الإدارة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
          FilledButton.tonalIcon(onPressed: () => _edit(), icon: const Icon(Icons.person_add_alt_1_rounded), label: const Text('إضافة')),
        ]),
        const SizedBox(height: 6),
        const Text('أدخل UID لحساب موجود في Firebase Authentication. لا يمكن إنشاء بيانات دخول من هذه اللوحة وحدها.'),
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance.collection('admins').limit(100).snapshots(),
          builder: (context, snapshot) {
            if (snapshot.hasError) return Text(firebaseErrorMessage(snapshot.error!));
            if (!snapshot.hasData) return const LinearProgressIndicator();
            if (snapshot.data!.docs.isEmpty) return const Text('لا توجد حسابات إدارة ظاهرة.');
            return Column(children: snapshot.data!.docs.map((doc) {
              final data = doc.data();
              final active = data['active'] == true;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(active ? Icons.admin_panel_settings_rounded : Icons.person_off_outlined),
                title: Text((data['email'] ?? doc.id).toString(), maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text((data['role'] ?? 'بدون دور').toString() + (active ? ' • نشط' : ' • معطّل')),
                trailing: IconButton(tooltip: 'تعديل الصلاحيات', onPressed: () => _edit(admin: {'id': doc.id, ...data}), icon: const Icon(Icons.edit_outlined)),
              );
            }).toList());
          },
        ),
      ]),
    ),
  );
}

class _AdminEditor extends StatefulWidget {
  const _AdminEditor({this.initial});
  final Map<String, dynamic>? initial;
  @override
  State<_AdminEditor> createState() => _AdminEditorState();
}
class _AdminEditorState extends State<_AdminEditor> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _uid;
  late final TextEditingController _email;
  String _role = 'reviewer';
  bool _active = true;
  @override
  void initState() {
    super.initState();
    final data = widget.initial ?? {};
    _uid = TextEditingController(text: (data['id'] ?? '').toString());
    _email = TextEditingController(text: (data['email'] ?? '').toString());
    final current = (data['role'] ?? '').toString().toLowerCase();
    if (const {'reviewer', 'content_admin', 'super_admin'}.contains(current)) _role = current;
    _active = data['active'] == true || widget.initial == null;
  }
  @override
  void dispose() { _uid.dispose(); _email.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.initial == null ? 'إضافة حساب إدارة' : 'تعديل حساب الإدارة'),
    content: SizedBox(width: 460, child: Form(
      key: _formKey,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextFormField(controller: _uid, readOnly: widget.initial != null, decoration: const InputDecoration(labelText: 'Firebase Auth UID'), validator: (v) => v == null || v.trim().isEmpty ? 'UID مطلوب' : null),
        const SizedBox(height: 10),
        TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'البريد الإلكتروني'), validator: (v) => v == null || !v.contains('@') ? 'أدخل بريدًا صحيحًا' : null),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _role,
          decoration: const InputDecoration(labelText: 'الدور'),
          items: const [
            DropdownMenuItem(value: 'reviewer', child: Text('مراجع المحتوى')),
            DropdownMenuItem(value: 'content_admin', child: Text('مدير المحتوى')),
            DropdownMenuItem(value: 'super_admin', child: Text('المدير الأعلى')),
          ],
          onChanged: (v) { if (v != null) setState(() => _role = v); },
        ),
        SwitchListTile(value: _active, contentPadding: EdgeInsets.zero, title: const Text('الحساب نشط'), onChanged: (v) => setState(() => _active = v)),
      ]),
    )),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
      FilledButton(onPressed: () {
        if (!_formKey.currentState!.validate()) return;
        Navigator.pop(context, {'uid': _uid.text.trim(), 'email': _email.text.trim(), 'role': _role, 'active': _active});
      }, child: const Text('حفظ الصلاحيات')),
    ],
  );
}

class AdminLogsManager extends StatelessWidget {
  const AdminLogsManager({super.key});
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 14),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('سجل الإدارة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('آخر 50 عملية إدارية مسجلة.'),
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance.collection('adminLogs').orderBy('timestamp', descending: true).limit(50).snapshots(),
          builder: (context, snapshot) {
            if (snapshot.hasError) return Text(firebaseErrorMessage(snapshot.error!));
            if (!snapshot.hasData) return const LinearProgressIndicator();
            final docs = snapshot.data!.docs;
            if (docs.isEmpty) return const Padding(padding: EdgeInsets.only(top: 8), child: Text('لا توجد سجلات متاحة.'));
            return Column(children: docs.map((doc) {
              final data = doc.data();
              final timestamp = data['timestamp'];
              final date = timestamp is Timestamp ? timestamp.toDate().toLocal().toString().split('.').first : 'وقت غير متاح';
              final description = [data['collection'], data['targetId'], date].where((x) => x != null && x.toString().isNotEmpty).join(' • ');
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.history_rounded),
                title: Text((data['action'] ?? 'عملية').toString(), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(description, maxLines: 2, overflow: TextOverflow.ellipsis),
              );
            }).toList());
          },
        ),
      ]),
    ),
  );
}

class StudyContentManager extends StatefulWidget {
  const StudyContentManager({super.key, required this.collectionName, required this.title, required this.user, required this.role});
  final String collectionName;
  final String title;
  final User user;
  final String role;
  @override
  State<StudyContentManager> createState() => _StudyContentManagerState();
}
class _StudyContentManagerState extends State<StudyContentManager> {
  List<Map<String, dynamic>> _branches = [];
  List<Map<String, dynamic>> _subjects = [];
  bool _loadingCatalog = true;
  @override
  void initState() { super.initState(); _loadCatalog(); }
  Future<void> _loadCatalog() async {
    try {
      final result = await Future.wait([
        StudyRepository.listCatalog('branches', limit: 60),
        StudyRepository.listCatalog('subjects', limit: 100),
      ]);
      if (mounted) setState(() { _branches = result[0]; _subjects = result[1]; _loadingCatalog = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingCatalog = false);
    }
  }
  Future<void> _edit({Map<String, dynamic>? item}) async {
    if (_loadingCatalog || _branches.isEmpty || _subjects.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تحقّق من بيانات الفروع والمواد قبل إضافة المحتوى.')));
      return;
    }
    final result = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (context) => _StudyContentEditor(collectionName: widget.collectionName, title: widget.title, branches: _branches, subjects: _subjects, initial: item),
    );
    if (result == null || !mounted) return;
    try {
      final ref = FirebaseFirestore.instance.collection(widget.collectionName);
      final id = item == null ? ref.doc().id : item['id'].toString();
      final payload = <String, dynamic>{...result, 'updatedAt': FieldValue.serverTimestamp()};
      if (item == null) {
        payload['createdAt'] = FieldValue.serverTimestamp();
        payload['createdBy'] = widget.user.uid;
        await ref.doc(id).set(payload);
      } else {
        await ref.doc(id).update(payload);
      }
      await _writeAdminLog(item == null ? 'create_content' : 'update_content', widget.collectionName, id, widget.user, widget.role);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ المحتوى.')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }
  Future<void> _toggle(Map<String, dynamic> item) async {
    final active = item['active'] != false;
    try {
      await FirebaseFirestore.instance.collection(widget.collectionName).doc(item['id'].toString()).update({'active': !active, 'updatedAt': FieldValue.serverTimestamp()});
      await _writeAdminLog(active ? 'deactivate_content' : 'activate_content', widget.collectionName, item['id'].toString(), widget.user, widget.role);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 14),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(widget.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
          FilledButton.tonalIcon(onPressed: _loadingCatalog ? null : () => _edit(), icon: const Icon(Icons.add_rounded), label: const Text('إضافة')),
        ]),
        const SizedBox(height: 6),
        const Text('إضافة المحتوى وتعديله أو إخفاؤه عن الطلاب دون حذف السجل.'),
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance.collection(widget.collectionName).orderBy('order').limit(30).snapshots(),
          builder: (context, snapshot) {
            if (snapshot.hasError) return Text(firebaseErrorMessage(snapshot.error!));
            if (!snapshot.hasData) return const LinearProgressIndicator();
            if (snapshot.data!.docs.isEmpty) return const Padding(padding: EdgeInsets.only(top: 10), child: Text('لا توجد سجلات في هذا القسم.'));
            return Column(children: snapshot.data!.docs.map((doc) {
              final data = doc.data();
              final item = <String, dynamic>{'id': doc.id, ...data};
              final active = data['active'] != false;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(widget.collectionName == 'foundations' ? Icons.menu_book_rounded : Icons.check_circle_outline_rounded, color: active ? const Color(0xFF0F766E) : const Color(0xFF94A3B8)),
                title: Text((data['title'] ?? 'محتوى').toString(), maxLines: 2, overflow: TextOverflow.ellipsis),
                subtitle: Text(active ? (data['subjectId'] ?? '').toString() : 'مخفي عن الطلاب'),
                onTap: () => _edit(item: item),
                trailing: IconButton(tooltip: active ? 'إخفاء' : 'إعادة النشر', onPressed: () => _toggle(item), icon: Icon(active ? Icons.visibility_off_outlined : Icons.visibility_outlined)),
              );
            }).toList());
          },
        ),
      ]),
    ),
  );
}

class _StudyContentEditor extends StatefulWidget {
  const _StudyContentEditor({required this.collectionName, required this.title, required this.branches, required this.subjects, this.initial});
  final String collectionName;
  final String title;
  final List<Map<String, dynamic>> branches;
  final List<Map<String, dynamic>> subjects;
  final Map<String, dynamic>? initial;
  @override
  State<_StudyContentEditor> createState() => _StudyContentEditorState();
}
class _StudyContentEditorState extends State<_StudyContentEditor> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _title, _description, _url, _body;
  String? _branchId, _subjectId;
  bool _active = true;
  @override
  void initState() {
    super.initState();
    final data = widget.initial ?? {};
    _title = TextEditingController(text: (data['title'] ?? '').toString());
    _description = TextEditingController(text: (data['description'] ?? '').toString());
    _url = TextEditingController(text: (data['url'] ?? '').toString());
    _body = TextEditingController(text: (data['solution'] ?? data['content'] ?? data['answer'] ?? '').toString());
    final branchIds = data['branchIds'] is List ? (data['branchIds'] as List).map((x) => '$x').toList() : <String>[];
    final wantedBranch = (data['branchId'] ?? (branchIds.isNotEmpty ? branchIds.first : '')).toString();
    _branchId = widget.branches.any((x) => x['id'] == wantedBranch) ? wantedBranch : widget.branches.first['id'].toString();
    final compatibleSubjects = widget.subjects.where((subject) =>
      _branchId == null ||
      ((subject['branchIds'] is List && (subject['branchIds'] as List).map((id) => '$id').contains(_branchId)) ||
       (subject['branchId'] ?? '').toString() == _branchId)
    ).toList();
    final wantedSubject = (data['subjectId'] ?? '').toString();
    _subjectId = compatibleSubjects.any((subject) => subject['id'] == wantedSubject)
      ? wantedSubject
      : (compatibleSubjects.isNotEmpty ? compatibleSubjects.first['id'].toString() : null);
    _active = data['active'] != false;
  }
  @override
  void dispose() { _title.dispose(); _description.dispose(); _url.dispose(); _body.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text((widget.initial == null ? 'إضافة ' : 'تعديل ') + widget.title),
    content: SizedBox(width: 520, child: SingleChildScrollView(child: Form(
      key: _formKey,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextFormField(controller: _title, maxLength: 200, decoration: const InputDecoration(labelText: 'العنوان'), validator: (v) => v == null || v.trim().isEmpty ? 'العنوان مطلوب' : null),
        const SizedBox(height: 8),
        TextFormField(controller: _description, maxLength: 3000, maxLines: 2, decoration: const InputDecoration(labelText: 'وصف مختصر')),
        if (widget.collectionName == 'foundations') ...[
          const SizedBox(height: 8),
          TextFormField(controller: _url, keyboardType: TextInputType.url, decoration: const InputDecoration(labelText: 'رابط اختياري')),
        ],
        if (widget.collectionName == 'solutions') ...[
          const SizedBox(height: 8),
          TextFormField(controller: _body, maxLength: 12000, maxLines: 6, decoration: const InputDecoration(labelText: 'نص الحل أو الشرح')),
        ],
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(initialValue: _branchId, isExpanded: true, decoration: const InputDecoration(labelText: 'الفرع'),
          items: widget.branches.map((x) => DropdownMenuItem(value: x['id'].toString(), child: Text((x['name'] ?? 'فرع').toString()))).toList(),
          onChanged: (v) => setState(() {
            _branchId = v;
            final compatible = widget.subjects.where((subject) =>
              v == null ||
              ((subject['branchIds'] is List &&
                (subject['branchIds'] as List).map((id) => '$id').contains(v)) ||
               (subject['branchId'] ?? '').toString() == v)
            ).toList();
            if (compatible.isEmpty) {
              _subjectId = null;
            } else if (!compatible.any((subject) => subject['id'] == _subjectId)) {
              _subjectId = compatible.first['id'].toString();
            }
          })),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(initialValue: _subjectId, isExpanded: true, decoration: const InputDecoration(labelText: 'المادة'),
          items: widget.subjects.where((x) => _branchId == null || ((x['branchIds'] is List && (x['branchIds'] as List).map((id) => '$id').contains(_branchId)) || (x['branchId'] ?? '').toString() == _branchId))
            .map((x) => DropdownMenuItem(value: x['id'].toString(), child: Text((x['name'] ?? 'مادة').toString()))).toList(),
          onChanged: (v) => setState(() => _subjectId = v)),
        SwitchListTile(value: _active, contentPadding: EdgeInsets.zero, title: const Text('نشط ومنشور'), onChanged: (v) => setState(() => _active = v)),
      ]),
    ))),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
      FilledButton(onPressed: () {
        if (!_formKey.currentState!.validate() || _branchId == null || _subjectId == null) return;
        final rawUrl = _url.text.trim();
        final uri = Uri.tryParse(rawUrl);
        if (widget.collectionName == 'foundations' && rawUrl.isNotEmpty && (uri == null || !['http', 'https'].contains(uri.scheme) || uri.host.isEmpty)) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('الرابط يجب أن يبدأ بـ http:// أو https://')));
          return;
        }
        final body = _body.text.trim();
        final payload = <String, dynamic>{
          'title': _title.text.trim(),
          'description': _description.text.trim(),
          'branchId': _branchId,
          'branchIds': [_branchId],
          'subjectId': _subjectId,
          'order': (widget.initial?['order'] as num?)?.toInt() ?? 0,
          'active': _active,
          'type': widget.collectionName == 'foundations' ? 'link' : 'explanation',
        };
        if (widget.collectionName == 'foundations') payload['url'] = rawUrl;
        if (widget.collectionName == 'solutions') {
          payload['solution'] = body;
          payload['content'] = body;
        }
        Navigator.pop(context, payload);
      }, child: const Text('حفظ')),
    ],
  );
}

Future<void> _writeAdminLog(String action, String collectionName, String targetId, User user, String role) async {
  await FirebaseFirestore.instance.collection('adminLogs').add({
    'adminUid': user.uid,
    'adminEmail': user.email ?? '',
    'role': role,
    'action': action,
    'collection': collectionName,
    'targetId': targetId,
    'details': '$action $targetId',
    'timestamp': FieldValue.serverTimestamp(),
  });
}


class SourceRegistryManager extends StatefulWidget {
  const SourceRegistryManager({super.key, required this.user});
  final User user;
  @override
  State<SourceRegistryManager> createState() => _SourceRegistryManagerState();
}
class _SourceRegistryManagerState extends State<SourceRegistryManager> {
  String _filter = 'all';

  Future<void> _setReviewState(
    QueryDocumentSnapshot<Map<String, dynamic>> document,
    bool needsReview,
  ) async {
    try {
      await document.reference.update({
        'needsReview': needsReview,
        'updatedAt': FieldValue.serverTimestamp(),
        'reviewedBy': widget.user.uid,
        if (!needsReview) 'reviewedAt': FieldValue.serverTimestamp(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(needsReview ? 'أعيد المصدر إلى قائمة المراجعة.' : 'تم تعليم المصدر كمُراجع.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(firebaseErrorMessage(error))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 14),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('سجل المصادر المستوردة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        const Text('مراجعة بيانات المصدر وحالة التصنيف. لا يتم نشر ملفات السجل تلقائيًا من هذه الشاشة.'),
        const SizedBox(height: 10),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'all', label: Text('الكل')),
            ButtonSegment(value: 'review', label: Text('تحتاج مراجعة')),
            ButtonSegment(value: 'conflict', label: Text('تعارض تصنيف')),
          ],
          selected: {_filter},
          onSelectionChanged: (values) => setState(() => _filter = values.first),
        ),
        const SizedBox(height: 8),
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance.collection('sourceRegistry').limit(100).snapshots(),
          builder: (context, snapshot) {
            if (snapshot.hasError) return Text(firebaseErrorMessage(snapshot.error!));
            if (!snapshot.hasData) return const LinearProgressIndicator();
            final rows = snapshot.data!.docs.where((doc) {
              final data = doc.data();
              if (_filter == 'review') return data['needsReview'] == true;
              if (_filter == 'conflict') return data['classificationConflict'] == true;
              return true;
            }).toList();
            if (rows.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(12),
                child: Text('لا توجد سجلات تطابق هذا الفلتر ضمن السجلات المحمّلة.'),
              );
            }
            return Column(children: rows.map((doc) {
              final data = doc.data();
              final title = (data['title'] ?? data['originalTitle'] ?? 'مصدر بلا عنوان').toString();
              final url = (data['url'] ?? '').toString();
              final pending = data['needsReview'] == true;
              final conflict = data['classificationConflict'] == true;
              final subtitle = [
                (data['provider'] ?? data['sourceType'] ?? '').toString(),
                (data['status'] ?? '').toString(),
                if (conflict) 'تعارض تصنيف',
                if (pending) 'تحتاج مراجعة',
              ].where((part) => part.isNotEmpty).join(' • ');
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  conflict ? Icons.warning_amber_rounded : pending ? Icons.rate_review_outlined : Icons.inventory_2_outlined,
                  color: conflict ? const Color(0xFFB45309) : pending ? const Color(0xFF0F766E) : const Color(0xFF64748B),
                ),
                title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
                subtitle: Text(subtitle.isEmpty ? url : subtitle, maxLines: 2, overflow: TextOverflow.ellipsis),
                trailing: PopupMenuButton<String>(
                  onSelected: (value) => _setReviewState(doc, value == 'review'),
                  itemBuilder: (context) => [
                    if (pending) const PopupMenuItem(value: 'done', child: Text('تمت المراجعة')),
                    if (!pending) const PopupMenuItem(value: 'review', child: Text('إعادة للمراجعة')),
                  ],
                ),
              );
            }).toList());
          },
        ),
      ]),
    ),
  );
}

class StudentDirectoryManager extends StatelessWidget {
  const StudentDirectoryManager({super.key});

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 14),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('دليل حسابات الطلاب', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        const Text('عرض محدود لآخر حسابات الطلاب. لا تعرض هذه الشاشة أرقام الهوية.'),
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance.collection('users').orderBy('createdAt', descending: true).limit(100).snapshots(),
          builder: (context, snapshot) {
            if (snapshot.hasError) return Text(firebaseErrorMessage(snapshot.error!));
            if (!snapshot.hasData) return const LinearProgressIndicator();
            final docs = snapshot.data!.docs;
            if (docs.isEmpty) return const Padding(padding: EdgeInsets.only(top: 8), child: Text('لا توجد حسابات طلاب ظاهرة.'));
            return Column(children: docs.map((doc) {
              final data = doc.data();
              final name = (data['name'] ?? 'طالب').toString();
              final email = (data['email'] ?? '').toString();
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(child: Icon(Icons.person_outline_rounded)),
                title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(email, maxLines: 1, overflow: TextOverflow.ellipsis),
              );
            }).toList());
          },
        ),
      ]),
    ),
  );
}
