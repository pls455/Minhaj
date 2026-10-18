import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../../core/widgets/async_state.dart';

class CatalogManager extends StatefulWidget {
  const CatalogManager({super.key, required this.collectionName, required this.title});
  final String collectionName;
  final String title;
  @override
  State<CatalogManager> createState() => _CatalogManagerState();
}

class _CatalogManagerState extends State<CatalogManager> {
  List<Map<String, dynamic>> _branches = [];
  bool _loadingBranches = true;

  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    try {
      final result = await FirebaseFirestore.instance.collection('branches').orderBy('order').limit(50).get();
      if (mounted) {
        setState(() {
        _branches = result.docs.map((doc) => {'id': doc.id, ...doc.data()}).where((row) => row['active'] != false).toList();
        _loadingBranches = false;
      });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingBranches = false);
    }
  }

  Future<void> _edit({Map<String, dynamic>? item}) async {
    if (widget.collectionName == 'subjects' && _loadingBranches) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('جارٍ تحميل قائمة الفروع.')));
      return;
    }
    final value = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (context) => _CatalogEditor(
        collectionName: widget.collectionName,
        title: widget.title,
        branches: _branches,
        initial: item,
      ),
    );
    if (value == null || !mounted) return;
    try {
      final collection = FirebaseFirestore.instance.collection(widget.collectionName);
      if (widget.collectionName == 'categories') {
        final duplicate = await collection.where('stableId', isEqualTo: value['stableId']).limit(2).get();
        if (duplicate.docs.any((doc) => doc.id != item?['id'])) {
          throw StateError('هذا المعرّف الثابت مستخدم بالفعل.');
        }
      }
      if (item == null) {
        await collection.add({
          ...value,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      } else {
        await collection.doc(item['id'].toString()).update({
          ...value,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ البيانات.')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }

  Future<void> _setActive(Map<String, dynamic> item, bool active) async {
    try {
      await FirebaseFirestore.instance.collection(widget.collectionName).doc(item['id'].toString())
        .update({'active': active, 'updatedAt': FieldValue.serverTimestamp()});
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 14),
    child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18))),
        FilledButton.tonalIcon(onPressed: () => _edit(), icon: const Icon(Icons.add_rounded), label: const Text('إضافة')),
      ]),
      const SizedBox(height: 5),
      Text(_description, style: const TextStyle(color: Color(0xFF58655F), height: 1.5)),
      StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance.collection(widget.collectionName).orderBy('order').limit(50).snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return Padding(padding: const EdgeInsets.all(12), child: Text(firebaseErrorMessage(snapshot.error!)));
          if (!snapshot.hasData) return const Padding(padding: EdgeInsets.all(12), child: LinearProgressIndicator());
          final docs = snapshot.data!.docs;
          if (docs.isEmpty) return const Padding(padding: EdgeInsets.all(12), child: Text('لا توجد سجلات في هذا القسم.'));
          return Column(children: docs.map((doc) {
            final data = doc.data();
            final item = <String, dynamic>{'id': doc.id, ...data};
            final active = data['active'] != false;
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(_icon, color: active ? const Color(0xFF173F35) : const Color(0xFF87958D)),
              title: Text((data['name'] ?? 'عنصر').toString(), maxLines: 2, overflow: TextOverflow.ellipsis),
              subtitle: Text(active ? (data['stableId'] ?? data['description'] ?? '').toString() : 'غير نشط'),
              onTap: () => _edit(item: item),
              trailing: PopupMenuButton<String>(
                onSelected: (value) => _setActive(item, value == 'active'),
                itemBuilder: (context) => [
                  PopupMenuItem(value: active ? 'inactive' : 'active', child: Text(active ? 'تعطيل' : 'إعادة التفعيل')),
                ],
              ),
            );
          }).toList());
        },
      ),
    ])),
  );

  String get _description => switch (widget.collectionName) {
    'branches' => 'إدارة الفروع الدراسية. التعطيل يخفي الفرع دون حذف السجلات المرتبطة به.',
    'subjects' => 'إدارة المواد وربط المادة بفرع واحد أو أكثر.',
    _ => 'إدارة التصنيفات ومعرّفاتها الثابتة المستخدمة في ربط المحتوى.',
  };

  IconData get _icon => switch (widget.collectionName) {
    'branches' => Icons.school_rounded,
    'subjects' => Icons.menu_book_rounded,
    _ => Icons.category_rounded,
  };
}

class _CatalogEditor extends StatefulWidget {
  const _CatalogEditor({required this.collectionName, required this.title, required this.branches, this.initial});
  final String collectionName, title;
  final List<Map<String, dynamic>> branches;
  final Map<String, dynamic>? initial;
  @override
  State<_CatalogEditor> createState() => _CatalogEditorState();
}
class _CatalogEditorState extends State<_CatalogEditor> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name, _description, _icon, _stableId, _order;
  final Set<String> _selectedBranches = {};
  bool _active = true;

  @override
  void initState() {
    super.initState();
    final data = widget.initial ?? {};
    _name = TextEditingController(text: (data['name'] ?? '').toString());
    _description = TextEditingController(text: (data['description'] ?? '').toString());
    _icon = TextEditingController(text: (data['icon'] ?? '').toString());
    _stableId = TextEditingController(text: (data['stableId'] ?? '').toString());
    _order = TextEditingController(text: (data['order'] ?? 0).toString());
    final values = data['branchIds'] is List ? (data['branchIds'] as List).map((e) => '$e') : const <String>[];
    _selectedBranches.addAll(values);
    final legacy = (data['branchId'] ?? '').toString();
    if (legacy.isNotEmpty) _selectedBranches.add(legacy);
    _active = data['active'] != false;
  }

  @override
  void dispose() {
    _name.dispose(); _description.dispose(); _icon.dispose(); _stableId.dispose(); _order.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text((widget.initial == null ? 'إضافة ' : 'تعديل ') + widget.title),
    content: SizedBox(width: 480, child: SingleChildScrollView(child: Form(
      key: _formKey,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextFormField(controller: _name, maxLength: 200, decoration: const InputDecoration(labelText: 'الاسم'), validator: (v) => (v == null || v.trim().isEmpty) ? 'الاسم مطلوب' : null),
        const SizedBox(height: 8),
        TextFormField(controller: _description, maxLength: 2000, maxLines: 3, decoration: const InputDecoration(labelText: 'الوصف')),
        const SizedBox(height: 8),
        TextFormField(controller: _icon, maxLength: 50, decoration: const InputDecoration(labelText: 'رمز اختياري')),
        if (widget.collectionName == 'categories') ...[
          const SizedBox(height: 8),
          TextFormField(controller: _stableId, maxLength: 64, decoration: const InputDecoration(labelText: 'المعرّف الثابت'), validator: (value) {
            final v = value?.trim() ?? '';
            return RegExp(r'^[a-z0-9][a-z0-9_-]{1,63}$').hasMatch(v) ? null : 'استخدم أحرفًا صغيرة وأرقامًا وشرطة أو شرطة سفلية.';
          }),
        ],
        const SizedBox(height: 8),
        TextFormField(controller: _order, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'ترتيب العرض')),
        if (widget.collectionName == 'subjects') ...[
          const SizedBox(height: 10),
          const Align(alignment: AlignmentDirectional.centerStart, child: Text('الفروع المرتبطة بالمادة', style: TextStyle(fontWeight: FontWeight.w700))),
          const SizedBox(height: 5),
          Wrap(spacing: 6, runSpacing: 4, children: widget.branches.map((branch) {
            final id = branch['id'].toString();
            return FilterChip(
              label: Text((branch['name'] ?? id).toString()),
              selected: _selectedBranches.contains(id),
              onSelected: (selected) => setState(() {
                if (selected) { _selectedBranches.add(id); } else { _selectedBranches.remove(id); }
              }),
            );
          }).toList()),
        ],
        SwitchListTile(value: _active, contentPadding: EdgeInsets.zero, title: const Text('نشط ومنشور'), onChanged: (value) => setState(() => _active = value)),
      ]),
    ))),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
      FilledButton(onPressed: () {
        if (!_formKey.currentState!.validate()) return;
        if (widget.collectionName == 'subjects' && _selectedBranches.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('اربط المادة بفرع واحد على الأقل.')));
          return;
        }
        final order = int.tryParse(_order.text.trim()) ?? 0;
        final payload = <String, dynamic>{
          'name': _name.text.trim(), 'description': _description.text.trim(), 'icon': _icon.text.trim(),
          'order': order < 0 ? 0 : order, 'active': _active,
        };
        if (widget.collectionName == 'subjects') {
          payload['branchIds'] = _selectedBranches.toList();
          payload['branchId'] = _selectedBranches.isEmpty ? '' : _selectedBranches.first;
        }
        if (widget.collectionName == 'categories') payload['stableId'] = _stableId.text.trim();
        Navigator.pop(context, payload);
      }, child: const Text('حفظ')),
    ],
  );
}
