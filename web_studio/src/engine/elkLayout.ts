import type {FlowGraphPayload} from '../types/graph';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';
export async function layout(graph:FlowGraphPayload) {
  const {default:ELK}=await import('elkjs/lib/elk-api.js');
  const elk=new ELK({workerUrl});
  try {
    const result=await elk.layout({id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.spacing.nodeNode':'50','elk.layered.spacing.nodeNodeBetweenLayers':'90'},children:graph.nodes.map(n=>({id:n.id,width:260,height:110})),edges:graph.edges.map(e=>({id:e.id,sources:[e.source],targets:[e.target]}))});
    return new Map(result.children?.map(n=>[n.id,{x:n.x??0,y:n.y??0}])??[]);
  } finally { elk.terminateWorker(); }
}
