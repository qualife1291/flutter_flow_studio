import type {FlowGraphPayload} from '../types/graph';
export function simplify(graph:FlowGraphPayload):FlowGraphPayload {
  const hidden=new Set(graph.edges.filter(e=>e.isStateBridge).flatMap(e=>[e.source]).filter(id=>graph.nodes.find(n=>n.id===id)?.kind==='ACTION'));
  const edges=[...graph.edges];
  for(const id of hidden) for(const incoming of edges.filter(e=>e.target===id)) for(const outgoing of edges.filter(e=>e.source===id)) {
    if(incoming.source!==outgoing.target) edges.push({...incoming,id:`collapsed:${incoming.id}:${outgoing.id}`,target:outgoing.target,isStateBridge:false});
  }
  return {...graph,nodes:graph.nodes.filter(n=>!hidden.has(n.id)),edges:edges.filter(e=>!hidden.has(e.source)&&!hidden.has(e.target))};
}
