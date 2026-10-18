import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

class AuthService {
  AuthService._();
  static final FirebaseAuth _auth = FirebaseAuth.instance;
  static final FirebaseFirestore _db = FirebaseFirestore.instance;
  static bool get isReady => Firebase.apps.isNotEmpty;
  static Stream<User?> authChanges() => isReady ? _auth.authStateChanges() : const Stream<User?>.empty();
  static User? get currentUser => isReady ? _auth.currentUser : null;

  static Future<UserCredential> signIn({required String email, required String password}) async {
    _requireFirebase();
    final credential = await _auth.signInWithEmailAndPassword(email: email.trim(), password: password);
    await _touchProfile(credential.user);
    return credential;
  }

  static Future<UserCredential> register({
    required String name, required String email, required String password, String? identityNumber,
  }) async {
    _requireFirebase();
    final cleanName = name.trim();
    final cleanEmail = email.trim();
    final identity = identityNumber?.trim();
    if (cleanName.isEmpty || cleanName.length > 100) throw ArgumentError('الاسم مطلوب ويجب ألا يتجاوز 100 حرف.');
    if (identity != null && identity.isNotEmpty && (identity.length < 4 || identity.length > 32)) {
      throw ArgumentError('رقم الهوية يجب أن يكون بين 4 و32 خانة.');
    }
    final credential = await _auth.createUserWithEmailAndPassword(email: cleanEmail, password: password);
    final uid = credential.user!.uid;
    await _db.collection('users').doc(uid).set({
      'name': cleanName, 'email': cleanEmail, 'role': 'student',
      'identityNumber': identity?.isEmpty == true ? null : identity,
      'createdAt': FieldValue.serverTimestamp(), 'lastLoginAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return credential;
  }

  static Future<void> _touchProfile(User? user) async {
    if (user == null) return;
    final reference = _db.collection('users').doc(user.uid);
    final snapshot = await reference.get();
    if (!snapshot.exists) {
      final display = user.displayName?.trim() ?? '';
      await reference.set({
        'name': display.isNotEmpty ? display : (user.email?.split('@').first ?? 'طالب'),
        'email': user.email ?? '', 'role': 'student', 'identityNumber': null,
        'createdAt': FieldValue.serverTimestamp(), 'lastLoginAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } else {
      await reference.update({'lastLoginAt': FieldValue.serverTimestamp(), 'updatedAt': FieldValue.serverTimestamp()});
    }
  }

  static Future<void> signOut() async { _requireFirebase(); await _auth.signOut(); }
  static Future<Map<String, dynamic>?> getProfile(String uid) async {
    _requireFirebase();
    final snapshot = await _db.collection('users').doc(uid).get();
    return snapshot.exists ? {'id': snapshot.id, ...?snapshot.data()} : null;
  }
  static void _requireFirebase() {
    if (!isReady) throw StateError('FIREBASE_NOT_CONFIGURED');
  }
}
