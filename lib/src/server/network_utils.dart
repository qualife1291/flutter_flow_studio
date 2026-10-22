import 'dart:io';

Future<List<String>> lanAddresses() async => [
  for (final i in await NetworkInterface.list(type: InternetAddressType.IPv4))
    for (final a in i.addresses) a.address,
];
