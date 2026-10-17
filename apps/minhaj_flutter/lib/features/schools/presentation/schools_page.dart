import 'package:flutter/material.dart';

import '../../../core/data/study_repository.dart';
import '../../../core/widgets/async_state.dart';

class SchoolsPage extends StatefulWidget {
  const SchoolsPage({super.key});
  @override
  State<SchoolsPage> createState() => _SchoolsPageState();
}
class _SchoolsPageState extends State<SchoolsPage> {
  final _search = TextEditingController();
  late Future<_SchoolDirectory> _future;
  @override
  void initState() { super.initState(); _future = _load(); }
  Future<_SchoolDirectory> _load() async {
    final results = await Future.wait([
      StudyRepository.listCatalog('schools', limit: 100),
      StudyRepository.listCatalog('directorates', limit: 100),
    ]);
    return _SchoolDirectory(results[0], results[1]);
  }
  @override
  void dispose() { _search.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => FutureBuilder<_SchoolDirectory>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
      if (snapshot.hasError) return AsyncStateView(message: firebaseErrorMessage(snapshot.error!), onRetry: () => setState(() => _future = _load()));
      final data = snapshot.data!;
      final needle = _search.text.trim().toLowerCase();
      final schools = data.schools.where((school) {
        final source = [
          school['name'], school['governorateName'], school['area'], school['type'],
          school['directorateName'], school['address'],
        ].map((value) => (value ?? '').toString().toLowerCase()).join(' ');
        return source.contains(needle);
      }).toList();
      return ListView(padding: const EdgeInsets.all(20), children: [
        Text('دليل المدارس', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 7),
        const Text('دليل معلوماتي مبني على السجلات الموجودة في منهاج. تحقّق من المدرسة مباشرة عند الحاجة إلى بيانات حديثة.'),
        const SizedBox(height: 14),
        TextField(controller: _search, onChanged: (_) => setState(() {}), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'ابحث باسم المدرسة أو المنطقة أو المديرية')),
        const SizedBox(height: 14),
        if (schools.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('لا توجد مدارس مطابقة في البيانات المتاحة.')),
        ...schools.map((school) {
          final name = (school['name'] ?? 'مدرسة').toString();
          final area = [school['governorateName'], school['area']].where((x) => x != null && x.toString().trim().isNotEmpty).join(' • ');
          final directorate = (school['directorateName'] ?? '').toString();
          final details = [
            if ((school['type'] ?? '').toString().isNotEmpty) school['type'].toString(),
            if ((school['gender'] ?? '').toString().isNotEmpty) school['gender'].toString(),
            if ((school['stages'] ?? '').toString().isNotEmpty) school['stages'].toString(),
          ].join(' • ');
          return Card(margin: const EdgeInsets.only(bottom: 12), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const CircleAvatar(child: Icon(Icons.school_rounded)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                if (area.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(area, style: const TextStyle(color: Color(0xFF64748B)))),
              ])),
            ]),
            if (details.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 9), child: Text(details)),
            if (directorate.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 5), child: Text('المديرية: $directorate')),
            if ((school['address'] ?? '').toString().trim().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 5), child: Text('العنوان: ${school['address']}')),
            if ((school['phone'] ?? '').toString().trim().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 5), child: SelectableText('الهاتف: ${school['phone']}')),
          ])));
        }),
        if (data.directorates.isNotEmpty) ...[
          const SizedBox(height: 22),
          Text('المديريات المسجلة', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: data.directorates.map((directorate) => Chip(
            avatar: const Icon(Icons.account_balance_outlined, size: 18),
            label: Text((directorate['name'] ?? 'مديرية').toString()),
          )).toList()),
        ],
      ]);
    },
  );
}

class _SchoolDirectory {
  const _SchoolDirectory(this.schools, this.directorates);
  final List<Map<String, dynamic>> schools, directorates;
}
