import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/widgets/async_state.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _identity = TextEditingController();
  bool _registerMode = false, _busy = false;
  String? _error;

  @override
  void dispose() { _name.dispose(); _email.dispose(); _password.dispose(); _identity.dispose(); super.dispose(); }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _busy = true; _error = null; });
    try {
      if (_registerMode) {
        await AuthService.register(
          name: _name.text, email: _email.text, password: _password.text,
          identityNumber: _identity.text.trim().isEmpty ? null : _identity.text.trim(),
        );
      } else {
        await AuthService.signIn(email: _email.text, password: _password.text);
      }
    } catch (error) {
      if (mounted) setState(() => _error = firebaseErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AuthService.isReady) {
      return const AsyncStateView(
      icon: Icons.account_circle_outlined,
      message: 'حسابات الطلاب تحتاج إعداد Firebase الخاص بالمشروع عند بناء التطبيق. يمكنك معاينة الواجهات، لكن تسجيل الدخول غير مفعّل في هذه النسخة.',
    );
    }
    return StreamBuilder<User?>(
      stream: AuthService.authChanges(),
      builder: (context, snapshot) {
        final user = snapshot.data;
        if (snapshot.connectionState == ConnectionState.waiting && user == null) return const Center(child: CircularProgressIndicator());
        if (user != null) return _profileBody(user);
        return _authForm();
      },
    );
  }

  Widget _authForm() => Center(child: SingleChildScrollView(
    padding: const EdgeInsets.all(20),
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 460),
      child: Card(child: Padding(
        padding: const EdgeInsets.all(22),
        child: Form(key: _formKey, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Icon(Icons.account_circle_rounded, size: 48, color: Color(0xFF0F766E)),
          const SizedBox(height: 10),
          Text(_registerMode ? 'إنشاء حساب طالب' : 'تسجيل الدخول', textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('التصفح متاح للجميع. تحتاج حسابًا لحفظ بطاقاتك وإنشاء اختباراتك.', textAlign: TextAlign.center, style: TextStyle(height: 1.6)),
          const SizedBox(height: 18),
          if (_registerMode) ...[
            TextFormField(controller: _name, decoration: const InputDecoration(labelText: 'الاسم'), validator: (v) => (v == null || v.trim().isEmpty) ? 'اكتب اسمك' : null),
            const SizedBox(height: 10),
            TextFormField(controller: _identity, decoration: const InputDecoration(labelText: 'رقم الهوية (اختياري)')),
            const SizedBox(height: 10),
          ],
          TextFormField(controller: _email, decoration: const InputDecoration(labelText: 'البريد الإلكتروني'), keyboardType: TextInputType.emailAddress, validator: (v) => (v == null || !v.contains('@')) ? 'أدخل بريدًا صحيحًا' : null),
          const SizedBox(height: 10),
          TextFormField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'كلمة المرور'), validator: (v) => (v == null || v.length < 6) ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : null),
          if (_error != null) ...[const SizedBox(height: 10), Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C)))],
          const SizedBox(height: 14),
          FilledButton(onPressed: _busy ? null : _submit, child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Text(_registerMode ? 'إنشاء الحساب' : 'دخول')),
          TextButton(onPressed: _busy ? null : () => setState(() { _registerMode = !_registerMode; _error = null; }),
            child: Text(_registerMode ? 'لديك حساب؟ سجّل الدخول' : 'ما عندك حساب؟ أنشئ حساب طالب')),
        ])),
      )),
    ),
  ));

  Widget _profileBody(User user) => FutureBuilder<Map<String, dynamic>?>(
    future: AuthService.getProfile(user.uid),
    builder: (context, snapshot) {
      final profile = snapshot.data ?? {};
      final displayName = (profile['name'] ?? user.displayName ?? 'طالب منهاج').toString();
      return ListView(padding: const EdgeInsets.all(20), children: [
        Card(child: Padding(padding: const EdgeInsets.all(20), child: Row(children: [
          const CircleAvatar(radius: 28, child: Icon(Icons.person_rounded, size: 30)),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(displayName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            const SizedBox(height: 4),
            Text(user.email ?? '', style: const TextStyle(color: Color(0xFF64748B))),
          ])),
        ]))),
        const SizedBox(height: 14),
        ListTile(leading: const Icon(Icons.style_rounded), title: const Text('بطاقاتي التعليمية'), onTap: () => context.go('/cards')),
        ListTile(leading: const Icon(Icons.quiz_rounded), title: const Text('اختباراتي'), onTap: () => context.go('/tests')),
        ListTile(leading: const Icon(Icons.admin_panel_settings_outlined), title: const Text('لوحة الإدارة'), subtitle: const Text('الأدوات المتاحة بحسب صلاحيات الحساب'), onTap: () => context.go('/admin')),
        const SizedBox(height: 14),
        OutlinedButton.icon(onPressed: () async {
          try {
            await AuthService.signOut();
          } catch (error) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(firebaseErrorMessage(error))),
            );
          }
        }, icon: const Icon(Icons.logout_rounded), label: const Text('تسجيل الخروج')),
      ]);
    },
  );
}
