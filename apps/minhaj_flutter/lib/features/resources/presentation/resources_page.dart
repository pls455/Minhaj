import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/data/study_repository.dart';
import '../../../core/widgets/async_state.dart';

String _branchAsset(String name) {
  final value = name.toLowerCase();
  if (value.contains('علمي') || value.contains('scientific')) return 'assets/branch_scientific.png';
  if (value.contains('أدبي') || value.contains('ادبي') || value.contains('literary')) return 'assets/branch_literary.png';
  if (value.contains('صناعي') || value.contains('industrial')) return 'assets/branch_industrial.png';
  return 'assets/minhaj-logo.png';
}

String _subjectAsset(String name) {
  final value = name.toLowerCase();
  if (value.contains('عربي') || value.contains('arabic')) return 'assets/subject_arabic.png';
  if (value.contains('رياض') || value.contains('math')) return 'assets/subject_math.png';
  if (value.contains('فيزياء') || value.contains('physics')) return 'assets/subject_physics.png';
  if (value.contains('كيمياء') || value.contains('chemistry')) return 'assets/subject_chemistry.png';
  if (value.contains('أحياء') || value.contains('احياء') || value.contains('biology')) return 'assets/subject_biology.png';
  if (value.contains('إنجليزي') || value.contains('انجليزي') || value.contains('english')) return 'assets/subject_english.png';
  if (value.contains('جغرافيا') || value.contains('geography')) return 'assets/subject_geography.png';
  if (value.contains('تاريخ') || value.contains('history')) return 'assets/subject_history.png';
  if (value.contains('إسلام') || value.contains('اسلام') || value.contains('islamic')) return 'assets/subject_islamic_education.png';
  if (value.contains('تكنولوجيا') || value.contains('technology')) return 'assets/subject_technology.png';
  if (value.contains('مهني') || value.contains('vocational')) return 'assets/subject_vocational.png';
  return 'assets/minhaj-logo.png';
}

class ResourcesPage extends StatefulWidget {
  const ResourcesPage({super.key, this.initialBranchId});
  final String? initialBranchId;
  @override
  State<ResourcesPage> createState() => _ResourcesPageState();
}

class _ResourcesPageState extends State<ResourcesPage> {
  final _search = TextEditingController();
  List<Map<String, dynamic>> _branches = [], _subjects = [], _items = [];
  String? _branchId, _subjectId, _error;
  DocumentSnapshot<Map<String, dynamic>>? _cursor;
  bool _hasMore = false, _loading = true, _moreLoading = false;

  @override
  void initState() { super.initState(); _branchId = widget.initialBranchId; _initialize(); }
  Future<void> _initialize() async {
    setState(() { _loading = true; _error = null; });
    try {
      final catalog = await Future.wait([
        StudyRepository.listCatalog('branches', limit: 30),
        StudyRepository.listCatalog('subjects', limit: 80),
      ]);
      _branches = catalog[0]; _subjects = catalog[1];
      await _load(reset: true);
    } catch (error) {
      if (mounted) setState(() { _error = firebaseErrorMessage(error); _loading = false; });
    }
  }

  Future<void> _load({required bool reset}) async {
    if (!StudyRepository.isReady) {
      setState(() { _error = firebaseErrorMessage(StateError('FIREBASE_NOT_CONFIGURED')); _loading = false; });
      return;
    }
    if (reset) {
      setState(() { _loading = true; _cursor = null; _items = []; _error = null; });
    } else {
      setState(() => _moreLoading = true);
    }
    try {
      final page = await StudyRepository.listResources(
        branchId: _branchId, subjectId: _subjectId, search: _search.text,
        cursor: reset ? null : _cursor,
      );
      if (!mounted) return;
      setState(() {
        _items = reset ? page.items : [..._items, ...page.items];
        _cursor = page.cursor; _hasMore = page.hasMore; _loading = false; _moreLoading = false; _error = null;
      });
    } catch (error) {
      if (mounted) setState(() { _error = firebaseErrorMessage(error); _loading = false; _moreLoading = false; });
    }
  }

  @override
  void dispose() { _search.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    if (_loading && _items.isEmpty) return const Center(child: CircularProgressIndicator());
    if (_error != null && _items.isEmpty) return AsyncStateView(message: _error!, onRetry: _initialize);
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: ListView(padding: const EdgeInsets.all(20), children: [
        Text('المصادر التعليمية', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('ابحث في المصادر المنشورة، وضيّق النتائج حسب الفرع أو المادة.'),
        const SizedBox(height: 16),
        TextField(controller: _search, textInputAction: TextInputAction.search, onSubmitted: (_) => _load(reset: true),
          decoration: InputDecoration(hintText: 'ابحث عن درس أو ملخص أو امتحان', prefixIcon: const Icon(Icons.search_rounded),
            suffixIcon: IconButton(icon: const Icon(Icons.arrow_forward_rounded), onPressed: () => _load(reset: true)))),
        const SizedBox(height: 10),
        LayoutBuilder(builder: (context, constraints) {
          final narrow = constraints.maxWidth < 560;
          final branch = DropdownButtonFormField<String>(
            initialValue: _branches.any((item) => item['id'] == _branchId) ? _branchId : null,
            isExpanded: true, decoration: const InputDecoration(labelText: 'الفرع'),
            items: [
              const DropdownMenuItem(value: '', child: Text('كل الفروع')),
              ..._branches.map((item) => DropdownMenuItem(
                value: item['id'].toString(),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  ClipRRect(borderRadius: BorderRadius.circular(7), child: Image.asset(
                    _branchAsset((item['name'] ?? 'فرع').toString()), width: 30, height: 30, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Icon(Icons.school_outlined, size: 24),
                  )),
                  const SizedBox(width: 8),
                  Flexible(child: Text((item['name'] ?? 'فرع').toString(), overflow: TextOverflow.ellipsis)),
                ]),
              )),
            ],
            onChanged: (value) { setState(() { _branchId = value == null || value.isEmpty ? null : value; _subjectId = null; }); _load(reset: true); },
          );
          final subject = DropdownButtonFormField<String>(
            initialValue: _subjects.any((item) => item['id'] == _subjectId) ? _subjectId : null,
            isExpanded: true, decoration: const InputDecoration(labelText: 'المادة'),
            items: [
              const DropdownMenuItem(value: '', child: Text('كل المواد')),
              ..._subjects.where((item) => _branchId == null ||
                ((item['branchIds'] is List && (item['branchIds'] as List).map((e) => '$e').contains(_branchId)) || (item['branchId'] ?? '').toString() == _branchId))
                .map((item) => DropdownMenuItem(
                value: item['id'].toString(),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  ClipRRect(borderRadius: BorderRadius.circular(7), child: Image.asset(
                    _subjectAsset((item['name'] ?? 'مادة').toString()), width: 30, height: 30, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Icon(Icons.menu_book_rounded, size: 24),
                  )),
                  const SizedBox(width: 8),
                  Flexible(child: Text((item['name'] ?? 'مادة').toString(), overflow: TextOverflow.ellipsis)),
                ]),
              )),
            ],
            onChanged: (value) { setState(() => _subjectId = value == null || value.isEmpty ? null : value); _load(reset: true); },
          );
          return narrow ? Column(children: [branch, const SizedBox(height: 10), subject]) : Row(children: [Expanded(child: branch), const SizedBox(width: 12), Expanded(child: subject)]);
        }),
        const SizedBox(height: 18),
        if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C)))),
        if (_items.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 36), child: Column(children: [
          Icon(Icons.search_off_rounded, size: 42, color: Color(0xFF87958D)), SizedBox(height: 12),
          Text('ما لقينا مصادر مطابقة. جرّب تغيير كلمة البحث أو الفلاتر.'),
        ])),
        ..._items.map((item) => _ResourceTile(item: item)),
        if (_hasMore) Padding(padding: const EdgeInsets.symmetric(vertical: 16),
          child: OutlinedButton.icon(onPressed: _moreLoading ? null : () => _load(reset: false),
            icon: _moreLoading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.expand_more_rounded),
            label: const Text('تحميل المزيد'))),
      ]),
    );
  }
}

class _ResourceTile extends StatelessWidget {
  const _ResourceTile({required this.item});
  final Map<String, dynamic> item;
  @override
  Widget build(BuildContext context) {
    final url = (item['url'] ?? '').toString();
    final type = (item['type'] ?? 'مصدر').toString();
    return Card(margin: const EdgeInsets.only(bottom: 12), child: Padding(padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: const Color(0xFFE8EFE9), borderRadius: BorderRadius.circular(13)),
            child: Icon(type.toLowerCase().contains('video') ? Icons.play_circle_outline_rounded : Icons.description_outlined, color: const Color(0xFF173F35))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text((item['title'] ?? 'مصدر تعليمي').toString(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 4), Text(type, style: const TextStyle(color: Color(0xFF173F35), fontSize: 12, fontWeight: FontWeight.w700)),
          ])),
        ]),
        if ((item['description'] ?? '').toString().trim().isNotEmpty) ...[
          const SizedBox(height: 10), Text(item['description'].toString(), style: const TextStyle(height: 1.6)),
        ],
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 6, children: [
          OutlinedButton.icon(
            onPressed: url.startsWith('https://') || url.startsWith('http://') ? () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication) : null,
            icon: const Icon(Icons.open_in_new_rounded, size: 17), label: const Text('فتح المصدر')),
          TextButton.icon(onPressed: () => _report(context), icon: const Icon(Icons.flag_outlined, size: 17), label: const Text('الإبلاغ عن مشكلة')),
        ]),
      ]),
    ));
  }

  Future<void> _report(BuildContext context) async {
    final user = AuthService.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('سجّل الدخول لإرسال بلاغ مرتبط بحسابك.')));
      context.go('/profile');
      return;
    }
    final controller = TextEditingController();
    final description = await showDialog<String?>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('الإبلاغ عن مشكلة'),
        content: SizedBox(width: 420, child: TextField(
          controller: controller, autofocus: true, maxLength: 2000, maxLines: 4,
          decoration: const InputDecoration(labelText: 'ما المشكلة في هذا المصدر؟', hintText: 'الرابط لا يعمل، العنوان غير صحيح...'),
        )),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, controller.text.trim()), child: const Text('إرسال')),
        ],
      ),
    );
    controller.dispose();
    if (description == null || description.trim().isEmpty) return;
    try {
      await FirebaseFirestore.instance.collection('problemReports').add({
        'sourceId': (item['id'] ?? '').toString(),
        'sourceTitle': (item['title'] ?? 'مصدر').toString(),
        'kind': 'resource_problem',
        'description': description.trim(),
        'status': 'open',
        'createdAt': FieldValue.serverTimestamp(),
        'studentUid': user.uid,
        'studentEmail': user.email ?? '',
      });
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إرسال البلاغ للمراجعة.')));
    } catch (error) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(firebaseErrorMessage(error))));
    }
  }
}
