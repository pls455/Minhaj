import 'dart:convert';
import 'package:http/http.dart' as http;

class AiService {
  AiService._();

  static const _baseUrl = String.fromEnvironment(
    'MINHAJ_AI_URL',
    defaultValue: 'https://minhaj1.karamhahhss123.workers.dev',
  );

  static Future<String> ask(String question, {String context = ''}) async {
    final base = _baseUrl.trim();
    if (base.isEmpty) throw StateError('AI_NOT_CONFIGURED');
    final endpoint = Uri.parse(base).resolve('/ai');
    final response = await http.post(
      endpoint,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'action': 'ask', 'question': question, 'context': context}),
    ).timeout(const Duration(seconds: 18));
    Map<String, dynamic> payload = {};
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) payload = decoded;
    } catch (_) {
      throw StateError('تعذّر قراءة استجابة مساعد منهاج.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300 || payload['ok'] != true) {
      final message = (payload['error'] ?? 'تعذّر الاتصال بالمساعد (HTTP ${response.statusCode}).').toString();
      throw StateError(message);
    }
    final result = payload['result'];
    if (result is String && result.trim().isNotEmpty) return result.trim();
    if (result is Map) {
      final answer = (result['answer'] ?? result['text'] ?? '').toString().trim();
      if (answer.isNotEmpty) return answer;
    }
    throw StateError('وصلت استجابة فارغة من المساعد.');
  }
}
