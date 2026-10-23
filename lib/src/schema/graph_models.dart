typedef Json = Map<String, dynamic>;

abstract class WireModel {
  final Json data;
  WireModel(Json json) : data = Map<String, dynamic>.from(json);
  Json toJson() => Map<String, dynamic>.from(data);
}

class FlowNodeData extends WireModel {
  FlowNodeData.fromJson(super.json);
  FlowNodeData({
    required String id,
    required String kind,
    required String technicalTitle,
    required String businessTitle,
    String featureGroup = 'app',
    Json? sourceLocation,
    Json? routeInfo,
    bool isTechnical = false,
    Json? apiInfo,
    Json? decisionInfo,
    Json? dialogInfo,
  }) : super({
         'id': id,
         'kind': kind,
         'featureGroup': featureGroup,
         'technicalTitle': technicalTitle,
         'businessTitle': businessTitle,
         if (isTechnical) 'isTechnical': true,
         if (sourceLocation != null) 'sourceLocation': sourceLocation,
         if (routeInfo != null) 'routeInfo': routeInfo,
         if (apiInfo != null) 'apiInfo': apiInfo,
         if (decisionInfo != null) 'decisionInfo': decisionInfo,
         if (dialogInfo != null) 'dialogInfo': dialogInfo,
       });
  String get id => data['id'] as String;
  String get kind => data['kind'] as String;
  String get technicalTitle => data['technicalTitle'] as String;
  Json? get decisionInfo => data['decisionInfo'] as Json?;
}

class FlowEdgeData extends WireModel {
  FlowEdgeData.fromJson(super.json);
  FlowEdgeData({
    required String source,
    required String target,
    String? sourceHandle,
    String? label,
    String? businessLabel,
    bool stateBridge = false,
    String? kind,
  }) : super({
         'id': 'edge:$source:$sourceHandle->$target',
         'source': source,
         'target': target,
         'kind':
             kind ??
             (stateBridge
                 ? 'STATE'
                 : sourceHandle != null
                 ? 'BRANCH'
                 : 'SEQUENCE'),
         if (sourceHandle != null) 'sourceHandle': sourceHandle,
         if (label != null) ...{
           'technicalLabel': label,
           'businessLabel': businessLabel ?? label,
         },
         if (stateBridge) 'isStateBridge': true,
       });
  String get id => data['id'] as String;
  String get source => data['source'] as String;
  String get target => data['target'] as String;
}

class FlowHealthIssue extends WireModel {
  FlowHealthIssue.fromJson(super.json);
  FlowHealthIssue(
    String category,
    String nodeId,
    String title,
    String suggestion, {
    String severity = 'WARNING',
  }) : super({
         'id': '$category:$nodeId',
         'severity': severity,
         'category': category,
         'nodeId': nodeId,
         'title': title,
         'suggestionForBA': suggestion,
         'suggestionForDev': suggestion,
       });
}

class FlowGraphPayload {
  final DateTime generatedAt;
  final Json project;
  final List<FlowNodeData> nodes;
  final List<FlowEdgeData> edges;
  final List<FlowHealthIssue> healthIssues;
  final Map<String, Json> sourceContexts;
  FlowGraphPayload({
    required this.project,
    required this.nodes,
    required this.edges,
    required this.healthIssues,
    DateTime? generatedAt,
    this.sourceContexts = const {},
  }) : generatedAt = generatedAt ?? DateTime.now().toUtc();
  factory FlowGraphPayload.fromJson(Json json) => FlowGraphPayload(
    generatedAt: DateTime.parse(json['generatedAt'] as String),
    project: Map<String, dynamic>.from(json['project'] as Map),
    sourceContexts: {
      for (final entry in (json['sourceContexts'] as Map? ?? {}).entries)
        entry.key as String: Map<String, dynamic>.from(entry.value as Map),
    },
    nodes: (json['nodes'] as List)
        .map((e) => FlowNodeData.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList(),
    edges: (json['edges'] as List)
        .map((e) => FlowEdgeData.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList(),
    healthIssues: (json['healthIssues'] as List)
        .map(
          (e) => FlowHealthIssue.fromJson(Map<String, dynamic>.from(e as Map)),
        )
        .toList(),
  );
  Json toJson() => {
    'generatedAt': generatedAt.toIso8601String(),
    'project': project,
    if (sourceContexts.isNotEmpty) 'sourceContexts': sourceContexts,
    'nodes': nodes.map((e) => e.toJson()).toList(),
    'edges': edges.map((e) => e.toJson()).toList(),
    'healthIssues': healthIssues.map((e) => e.toJson()).toList(),
  };
}
