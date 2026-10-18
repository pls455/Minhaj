import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:minhaj/app.dart';

void main() {
  testWidgets('home screen renders in Arabic without Firebase configuration',
      (tester) async {
    await tester.pumpWidget(const MinhajApp());
    await tester.pumpAndSettle();

    expect(find.text('MINHAJ'), findsOneWidget);
    expect(find.text('طريقك للتوجيهي، أوضح'), findsOneWidget);
    expect(find.text('استكشف المصادر'), findsOneWidget);
  });

  testWidgets('uses the MINHAJ forest-green and sand-gold palette',
      (tester) async {
    await tester.pumpWidget(const MinhajApp());
    await tester.pumpAndSettle();

    final context = tester.element(find.text('طريقك للتوجيهي، أوضح'));
    final scheme = Theme.of(context).colorScheme;
    expect(scheme.primary, const Color(0xFF173F35));
    expect(scheme.secondary, const Color(0xFFC5A46D));
  });
}
