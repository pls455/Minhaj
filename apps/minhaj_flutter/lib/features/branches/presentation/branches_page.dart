import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/data/study_repository.dart';
import '../../../core/widgets/async_state.dart';

class BranchesPage extends StatefulWidget {
  const BranchesPage({super.key});
  @override
  State<BranchesPage> createState() => _BranchesPageState();
}

class _BranchesPageState extends State<BranchesPage> {
  late Future<_Catalog> _future;
  @override
  void initState() { super.initState(); _future = _load(); }
  Future<_Catalog> _load() async {
    final results = await Future.wait([
      StudyRepository.listCatalog('branches', limit: 30),
      StudyRepository.listCatalog('subjects', limit: 80),
    ]);
    return _Catalog(results[0], results[1]);
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<_Catalog>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
      if (snapshot.hasError) return AsyncStateView(
        message: firebaseErrorMessage(snapshot.error!), onRetry: () => setState(() => _future = _load()),
      );
      final data = snapshot.data!;
      if (data.branches.isEmpty) return const AsyncStateView(icon: Icons.school_outlined, message: 'لا توجد فروع منشورة بعد. عند ربط Firebase ستظهر الفروع المسجلة في منهاج.');
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('اختَر فرعك', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('اختيار الفرع يساعدك على الوصول إلى المواد والمصادر المرتبطة به.'),
          const SizedBox(height: 18),
          ...data.branches.map((branch) {
            final id = (branch['id'] ?? '').toString();
            final name = (branch['name'] ?? 'فرع دراسي').toString();
            final branchSubjects = data.subjects.where((subject) {
              final ids = subject['branchIds'];
              return (ids is List && ids.map((e) => '$e').contains(id)) || (subject['branchId'] ?? '').toString() == id;
            }).toList();
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => context.go(Uri(path: '/resources', queryParameters: {'branchId': id}).toString()),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(children: [
                    Container(width: 54, height: 54, decoration: BoxDecoration(color: const Color(0xFFE6F4F1), borderRadius: BorderRadius.circular(16)), child: const Icon(Icons.school_rounded, color: Color(0xFF0F766E), size: 28)),
                    const SizedBox(width: 14),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                      const SizedBox(height: 4),
                      Text(branchSubjects.length.toString() + ' مادة ظاهرة', style: const TextStyle(color: Color(0xFF64748B))),
                      if ((branch['description'] ?? '').toString().trim().isNotEmpty) ...[
                        const SizedBox(height: 5),
                        Text(branch['description'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis),
                      ],
                    ])),
                    const Icon(Icons.arrow_back_ios_new_rounded, size: 17),
                  ]),
                ),
              ),
            );
          }),
        ],
      );
    },
  );
}

class _Catalog {
  const _Catalog(this.branches, this.subjects);
  final List<Map<String, dynamic>> branches;
  final List<Map<String, dynamic>> subjects;
}
