# إعداد Firebase لـ Minhaj v2

## 1) لا تحذف البيانات الحالية
احتفظ بـ `subjects` و `resources` كما هي.

## 2) إنشاء أول Super Admin
بعد نشر النسخة الجديدة، افتح Firebase Authentication > Users وانسخ UID لحساب الأدمن الحالي.
ثم في Firestore أنشئ:

`admins/{UID}`

بالحقول:
- `role`: `superadmin`
- `active`: `true`
- `email`: بريد الأدمن (اختياري لكنه مفيد)

## 3) Rules
انسخ محتوى `firestore.rules` إلى Firestore Database > Rules ثم Publish.

> مهم: لا تنشر القواعد قبل إنشاء مستند `admins/{UID}` للأدمن الحالي، وإلا سيتوقف دخول لوحة الإدارة الجديدة عن العمل.

## 4) Collections الجديدة
لا تحتاج إنشاءها يدويًا. ستنشأ عند أول استخدام:
- `foundations`
- `suggestions`
- `admins`

## 5) Storage
غير مطلوب حاليًا. الموقع يقبل روابط فقط ولا يرفع PDF.

## 6) JSON الجماعي
الاستيراد الجماعي موجود داخل لوحة الأدمن فقط، للمصادر والتأسيس، ويمنع تكرار الرابط أثناء الاستيراد.
