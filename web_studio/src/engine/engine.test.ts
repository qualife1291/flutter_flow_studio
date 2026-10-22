import {describe,it,expect} from 'vitest';
import type {FlowGraphPayload,FlowNodeData,RuntimeStepEvent} from '../types/graph';
import {branchKey,coverage,inferPath,matchEvent} from './pathInference';
import {serialize,safeEvents} from './exporters';
import {simplify} from './lowCodeSimplifier';
import {useFlowStore} from '../store/useFlowStore';
const nodes:FlowNodeData[]=[{id:'start',kind:'SCREEN',featureGroup:'auth',technicalTitle:'LoginScreen',businessTitle:'Đăng nhập'}, {id:'decision',kind:'DECISION',featureGroup:'auth',technicalTitle:'ok',businessTitle:'Hợp lệ?',decisionInfo:{kind:'IF_ELSE',rawExpression:'ok',humanReadableRule:'Hợp lệ?',branches:[{branchId:'true',technicalLabel:'true',businessLabel:'Đúng'},{branchId:'false',technicalLabel:'false',businessLabel:'Sai'}]}},{id:'end',kind:'DIALOG',featureGroup:'auth',technicalTitle:'Error',businessTitle:'Lỗi'}];
const graph={generatedAt:'2026-10-22',project:{projectName:'test',description:'Fixture',version:'1.0.0',flutterSdkVersion:'3.41.9',dartSdkConstraint:'>=3.8.0 <4.0.0',detectedArchitecture:{stateManagement:[],routing:[],networking:[],localStorage:[]},allDependencies:[],stats:{totalScreens:1,totalActions:0,totalDecisions:1,totalApis:0,totalDialogs:1,totalLogoutPoints:0}},nodes,edges:[{id:'a',source:'start',target:'decision'},{id:'b',source:'decision',target:'end',sourceHandle:'false'}],healthIssues:[]} as FlowGraphPayload;
const event=(sequenceOrder:number,extra:Partial<RuntimeStepEvent>={}):RuntimeStepEvent=>({type:'RUNTIME_STEP',sessionId:'one',deviceName:'android',timestamp:1,sequenceOrder,eventKind:'ROUTE_PUSH',...extra});
describe('execution evidence',()=>{
 it('infers a unique path only',()=>{expect(inferPath(graph,'start','end')).toEqual(['a','b']);expect(inferPath({...graph,edges:[...graph.edges,{id:'c',source:'start',target:'end'}]},'start','end')).toEqual([]);});
 it('handles cycles without claiming ambiguous evidence',()=>{expect(inferPath({...graph,edges:[...graph.edges,{id:'cycle',source:'decision',target:'start'}]},'start','end')).toEqual(['a','b']);});
 it('unknown or ambiguous event mapping remains unmatched',()=>{expect(matchEvent(graph,event(1,{routeName:'LoginScreen'}))).toBe('start');expect(matchEvent({...graph,nodes:[...nodes,{...nodes[0],id:'other'}]},event(1,{routeName:'LoginScreen'}))).toBeUndefined();});
 it('only confirmed branch probes count toward coverage',()=>{expect(coverage(graph,new Set())).toEqual({tested:0,total:2,percent:0});expect(coverage(graph,new Set([branchKey('decision','false')]))).toEqual({tested:1,total:2,percent:50});});
 it('inferred paths never increase confirmed coverage and duplicate events are ignored',()=>{
  const s=useFlowStore.getState();s.reset();s.setGraph(graph);s.receive(event(1,{matchedNodeId:'start'}));s.receive(event(2,{matchedNodeId:'end'}));s.receive(event(2,{matchedNodeId:'end'}));
  expect(useFlowStore.getState().events).toHaveLength(2);expect(useFlowStore.getState().inferred.has('b')).toBe(true);expect(useFlowStore.getState().confirmed.size).toBe(0);
  s.receive(event(3,{eventKind:'BRANCH_HIT',matchedNodeId:'decision',matchedBranchId:'false'}));expect(coverage(graph,useFlowStore.getState().confirmed).tested).toBe(1);
 });
 it('does not infer across device sessions',()=>{const s=useFlowStore.getState();s.reset();s.setGraph(graph);s.receive(event(1,{matchedNodeId:'start'}));s.receive(event(1,{sessionId:'two',matchedNodeId:'end'}));expect(useFlowStore.getState().inferred.size).toBe(0);});
});
describe('exports',()=>{
 it('outputs all graph formats with nodes and edges',()=>{for(const format of ['mmd','drawio','excalidraw','puml','flow.json'] as const)expect(serialize(graph,format,true)).toContain(format==='mmd'||format==='puml'?'n0':format==='drawio'?'mxCell':format==='excalidraw'?'arrow':'graph');});
 it('snapshot excludes payloads unless explicitly selected',()=>{const e=event(1,{apiDetails:{method:'POST',url:'/login',requestBody:{password:'secret'}}});expect(JSON.stringify(safeEvents([e],false))).not.toContain('secret');expect(JSON.stringify(safeEvents([e],true))).toContain('secret');});
 it('low-code removes bridge intermediary without orphan edges',()=>{const g={...graph,nodes:[...nodes,{...nodes[0],id:'technical',kind:'ACTION' as const}],edges:[{id:'in',source:'start',target:'technical'},{id:'out',source:'technical',target:'end',isStateBridge:true}]};const simplified=simplify(g);expect(simplified.nodes.some(n=>n.id==='technical')).toBe(false);expect(simplified.edges.some(e=>e.source==='start'&&e.target==='end')).toBe(true);});
});
