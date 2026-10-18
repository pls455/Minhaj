import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/data/study_repository.dart';
import '../../../core/widgets/async_state.dart';

class LibraryPage extends StatefulWidget {
  const LibraryPage({super.key, required this.collectionName, required this.title});
  final String collectionName;
  final String title;
  @override
  State<LibraryPage> createState() => _LibraryPageState();
}
class _LibraryPageState extends State<LibraryPage> {
  late Future<List<Map<String, dynamic>>> _future;
  final _search = TextEditingController();
  @override
  void initState() { super.initState(); _future = _load(); }
  Future<List<Map<String, dynamic>>> _load() => StudyRepository.listCatalog(widget.collectionName, limit: 80);
  @override
  void dispose() { _search.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Map<String, dynamic>>>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
      if (snapshot.hasError) return AsyncStateView(message: firebaseErrorMessage(snapshot.error!), onRetry: () => setState(() => _future = _load()));
      final query = _search.text.trim().toLowerCase();
      final items = (snapshot.data ?? []).where((item) =>
        (item['title'] ?? item['name'] ?? item['question'] ?? '').toString().toLowerCase().contains(query) ||
        (item['description'] ?? item['solution'] ?? item['answer'] ?? '').toString().toLowerCase().contains(query)
      ).toList();
      return ListView(padding: const EdgeInsets.all(20), children: [
        Text(widget.title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text(widget.collectionName == 'foundations' ? 'مواد تأسيس ومراجعة للمفاهيم الأساسية.' : 'حلول وشروحات مرتبطة بالمناهج والمواد.'),
        const SizedBox(height: 14),
        TextField(controller: _search, onChanged: (_) => setState(() {}), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'ابحث في هذا القسم')),
        const SizedBox(height: 14),
        if (items.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('لا توجد نتائج مطابقة في البيانات المتاحة.')),
        ...items.map((item) {
          final title = (item['title'] ?? item['name'] ?? item['question'] ?? 'محتوى تعليمي').toString();
          final body = (item['description'] ?? item['solution'] ?? item['answer'] ?? item['content'] ?? '').toString();
          final url = (item['url'] ?? '').toString();
          return Card(margin: const EdgeInsets.only(bottom: 12), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            if (body.trim().isNotEmpty) ...[const SizedBox(height: 9), SelectableText(body, style: const TextStyle(height: 1.7))],
            if (url.startsWith('https://') || url.startsWith('http://')) ...[
              const SizedBox(height: 10),
              Align(alignment: AlignmentDirectional.centerStart, child: OutlinedButton.icon(
                onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                icon: const Icon(Icons.open_in_new_rounded), label: const Text('فتح المصدر'),
              )),
            ],
          ])));
        }),
      ]);
    },
  );
}
