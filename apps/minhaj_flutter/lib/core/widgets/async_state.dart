import 'package:flutter/material.dart';

class AsyncStateView extends StatelessWidget {
  const AsyncStateView({super.key, required this.message, this.onRetry, this.icon = Icons.cloud_off_rounded});
  final String message;
  final VoidCallback? onRetry;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 440),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 40, color: const Color(0xFF64748B)),
          const SizedBox(height: 14),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(height: 1.7)),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('إعادة المحاولة')),
          ],
        ]),
      ),
    ),
  );
}

String firebaseErrorMessage(Object error) {
  final value = error.toString();
  if (value.contains('FIREBASE_NOT_CONFIGURED')) return 'خدمات Firebase غير مُعدّة في نسخة التطوير. أضف إعدادات المشروع عند البناء لتفعيل البيانات وتسجيل الدخول.';
  if (value.contains('permission-denied')) return 'ليس لديك صلاحية لقراءة هذه البيانات. تحقّق من الحساب وقواعد Firestore.';
  if (value.contains('failed-precondition')) return 'الاستعلام يحتاج فهرسًا في Firestore. راجع رسالة الخطأ ثم أضف الفهرس المطلوب.';
  if (value.contains('network') || value.contains('unavailable')) return 'تعذّر الاتصال بالخدمة. تحقّق من الإنترنت ثم أعد المحاولة.';
  if (value.contains('email-already-in-use')) return 'هذا البريد مسجّل بالفعل.';
  if (value.contains('invalid-credential') || value.contains('wrong-password') || value.contains('user-not-found')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  return 'حدث خطأ أثناء تنفيذ العملية. ' + (value.length > 180 ? value.substring(0, 180) : value);
}
