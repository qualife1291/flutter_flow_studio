import 'dart:io';

String get devicePlatform => Platform.operatingSystem;
String get defaultStudioHost => Platform.isAndroid ? '10.0.2.2' : '127.0.0.1';
