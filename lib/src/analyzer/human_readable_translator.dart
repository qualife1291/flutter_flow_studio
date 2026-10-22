class HumanReadableTranslator {
  String translate(String source, {String? comment}) {
    final annotated = comment == null
        ? null
        : RegExp(r'(?:@flow:|Flow:)\s*([^\n]+)').firstMatch(comment)?.group(1);
    if (annotated != null) return annotated.trim();
    var text = source.replaceAllMapped(
      RegExp(r'(?:\w+\.)?statusCode\s*==\s*(200|401|403)'),
      (m) => m[1] == '200'
          ? 'API Thành công (HTTP 200)'
          : 'Hết hạn phiên / Chưa đăng nhập (${m[1]})',
    );
    text = text.replaceAll(
      RegExp(r'(?:\w+\.)?statusCode\s*>=\s*500'),
      'Lỗi máy chủ (5xx)',
    );
    for (final entry in {
      '.isNotEmpty': ' Có dữ liệu',
      '.isEmpty': ' Trống / Rỗng',
      '!= null': ' Đã có dữ liệu',
      '== null': ' Chưa có giá trị',
      '&&': ' VÀ ',
      '||': ' HOẶC ',
    }.entries) {
      text = text.replaceAll(entry.key, entry.value);
    }
    return text
        .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}')
        .replaceAll('_', ' ')
        .replaceAll(RegExp(r'!(?!=)'), 'Không ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }
}
