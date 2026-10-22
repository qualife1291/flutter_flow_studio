import 'dart:convert';
import '../schema/graph_models.dart';

String exportGraph(
  FlowGraphPayload graph,
  String format, {
  bool business = false,
}) {
  final data = graph.toJson();
  final labels = {
    for (final n in graph.nodes)
      n.id: (n.data[business ? 'businessTitle' : 'technicalTitle'] as String),
  };
  final ids = {
    for (var i = 0; i < graph.nodes.length; i++) graph.nodes[i].id: 'n$i',
  };
  String xml(String s) => const HtmlEscape(
    HtmlEscapeMode.element,
  ).convert(s).replaceAll('"', '&quot;');
  switch (format) {
    case 'json':
      return const JsonEncoder.withIndent('  ').convert(data);
    case 'mmd':
      return 'flowchart LR\n${labels.entries.map((e) => '  ${ids[e.key]}["${xml(e.value).replaceAll('\n', ' ')}"]').join('\n')}\n${graph.edges.map((e) => '  ${ids[e.source]} --> ${ids[e.target]}').join('\n')}\n';
    case 'puml':
      return '@startuml\n${labels.entries.map((e) => 'rectangle "${e.value.replaceAll('"', "'").replaceAll('\n', ' ')}" as ${ids[e.key]}').join('\n')}\n${graph.edges.map((e) => '${ids[e.source]} --> ${ids[e.target]}').join('\n')}\n@enduml\n';
    case 'drawio':
      return '<mxfile><diagram name="Flow"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${graph.nodes.asMap().entries.map((e) => '<mxCell id="${ids[e.value.id]}" value="${xml(labels[e.value.id]!)}" vertex="1" parent="1"><mxGeometry x="${(e.key % 4) * 300}" y="${(e.key ~/ 4) * 140}" width="260" height="80" as="geometry"/></mxCell>').join()}${graph.edges.asMap().entries.map((e) => '<mxCell id="e${e.key}" edge="1" parent="1" source="${ids[e.value.source]}" target="${ids[e.value.target]}"><mxGeometry relative="1" as="geometry"/></mxCell>').join()}</root></mxGraphModel></diagram></mxfile>';
    default:
      throw ArgumentError('Unsupported export: $format');
  }
}
