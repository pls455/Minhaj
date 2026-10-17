import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';

class StudyPage {
  const StudyPage({required this.items, required this.hasMore, this.cursor});
  final List<Map<String, dynamic>> items;
  final bool hasMore;
  final DocumentSnapshot<Map<String, dynamic>>? cursor;
}

class StudyRepository {
  StudyRepository._();
  static FirebaseFirestore get _db => FirebaseFirestore.instance;
  static bool get isReady => Firebase.apps.isNotEmpty;

  static Future<List<Map<String, dynamic>>> listCatalog(
    String collectionName, {int limit = 60, bool activeOnly = true}
  ) async {
    _requireFirebase();
    final safeLimit = limit.clamp(1, 100).toInt();
    try {
      Query<Map<String, dynamic>> query = _db.collection(collectionName);
      if (activeOnly) query = query.where('active', isEqualTo: true);
      final snapshot = await query.orderBy('order').limit(safeLimit).get();
      return snapshot.docs.map(_asMap).toList(growable: false);
    } on FirebaseException catch (error) {
      if (error.code != 'failed-precondition' && error.code != 'invalid-argument') rethrow;
      final snapshot = await _db.collection(collectionName).limit(safeLimit).get();
      final rows = snapshot.docs.map(_asMap).where((row) => !activeOnly || row['active'] != false).toList();
      rows.sort((a, b) => _orderOf(a).compareTo(_orderOf(b)));
      return rows;
    }
  }

  static Future<StudyPage> listResources({
    String? branchId, String? subjectId, String search = '', int pageSize = 24,
    DocumentSnapshot<Map<String, dynamic>>? cursor,
  }) async {
    _requireFirebase();
    final size = pageSize.clamp(1, 50).toInt();
    final needle = search.trim();
    try {
      Query<Map<String, dynamic>> query = _db.collection('resources').where('active', isEqualTo: true);
      if (subjectId != null && subjectId.isNotEmpty) query = query.where('subjectId', isEqualTo: subjectId);
      if (branchId != null && branchId.isNotEmpty) query = query.where('branchIds', arrayContains: branchId);
      if (needle.isNotEmpty) {
        query = query.orderBy('title').startAt([needle]).endAt(['$needle\uf8ff']);
      } else {
        query = query.orderBy('order');
      }
      if (cursor != null) query = query.startAfterDocument(cursor);
      final snapshot = await query.limit(size + 1).get();
      final hasMore = snapshot.docs.length > size;
      final docs = snapshot.docs.take(size).toList();
      final items = docs.map(_asMap).toList();
      if (branchId != null && branchId.isNotEmpty && items.isEmpty && cursor == null) {
        final legacy = await _legacyBranchResources(branchId: branchId, subjectId: subjectId, search: needle, limit: size);
        return StudyPage(items: legacy, hasMore: false);
      }
      return StudyPage(items: items, hasMore: hasMore, cursor: docs.isEmpty ? null : docs.last);
    } on FirebaseException catch (error) {
      if (error.code != 'failed-precondition' && error.code != 'invalid-argument') rethrow;
      // Bounded compatibility fallback for older data and missing composite indexes.
      final snapshot = await _db.collection('resources').where('active', isEqualTo: true).limit(100).get();
      final rows = snapshot.docs.map(_asMap).where((row) {
        final title = _text(row['title']).toLowerCase();
        final matchesBranch = branchId == null || branchId.isEmpty || _branchIds(row).contains(branchId);
        final matchesSubject = subjectId == null || subjectId.isEmpty || _text(row['subjectId']) == subjectId;
        return matchesBranch && matchesSubject && (needle.isEmpty || title.contains(needle.toLowerCase()));
      }).toList();
      rows.sort((a, b) => _orderOf(a).compareTo(_orderOf(b)));
      return StudyPage(items: rows.take(size).toList(), hasMore: false);
    }
  }

  static Future<List<Map<String, dynamic>>> _legacyBranchResources({
    required String branchId, required String? subjectId, required String search, required int limit,
  }) async {
    final snapshot = await _db.collection('resources').where('active', isEqualTo: true).where('branchId', isEqualTo: branchId).limit(100).get();
    final rows = snapshot.docs.map(_asMap).where((row) {
      final matchesSubject = subjectId == null || subjectId.isEmpty || _text(row['subjectId']) == subjectId;
      final matchesSearch = search.isEmpty || _text(row['title']).toLowerCase().contains(search.toLowerCase());
      return matchesSubject && matchesSearch;
    }).toList();
    rows.sort((a, b) => _orderOf(a).compareTo(_orderOf(b)));
    return rows.take(limit).toList();
  }

  static Future<Map<String, dynamic>?> getAdmin(String uid) async {
    _requireFirebase();
    final snapshot = await _db.collection('admins').doc(uid).get();
    if (!snapshot.exists) return null;
    return {'id': snapshot.id, ...?snapshot.data()};
  }

  static Map<String, dynamic> _asMap(QueryDocumentSnapshot<Map<String, dynamic>> doc) => {'id': doc.id, ...doc.data()};
  static List<String> _branchIds(Map<String, dynamic> row) {
    final value = row['branchIds'];
    if (value is List) return value.map((item) => '$item').toList();
    final single = _text(row['branchId']);
    return single.isEmpty ? const [] : [single];
  }
  static String _text(dynamic value) => value?.toString().trim() ?? '';
  static int _orderOf(Map<String, dynamic> row) => (row['order'] as num?)?.toInt() ?? 0;
  static void _requireFirebase() {
    if (!isReady) throw StateError('FIREBASE_NOT_CONFIGURED');
  }
}
