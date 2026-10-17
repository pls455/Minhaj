import 'package:flutter_test/flutter_test.dart';
import 'package:minhaj/app.dart';

void main() {
  testWidgets('home screen renders in Arabic without Firebase configuration',
      (tester) async {
    await tester.pumpWidget(const MinhajApp());
    await tester.pumpAndSettle();

    expect(find.text('مِنهَاج'), findsOneWidget);
    expect(find.text('طريقك للتوجيهي، أوضح'), findsOneWidget);
    expect(find.text('استكشف المصادر'), findsOneWidget);
  });
}
