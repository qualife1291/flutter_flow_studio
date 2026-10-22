import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ReactFlowProvider} from '@xyflow/react';
import {Activity,Search,Download,X,Maximize,RotateCcw,Upload,ArrowRight} from 'lucide-react';
import {imageData} from './engine/exporters/image';
import type {FlowGraphPayload,RoleViewMode,RuntimeStepEvent} from './types/graph';
import {useFlowStore} from './store/useFlowStore';
import {FlowCanvas} from './components/FlowCanvas';
import {coverage,branchKey,inferPath,matchEvent} from './engine/pathInference';
import {simplify} from './engine/lowCodeSimplifier';
import {download,serialize,safeEvents,type Format} from './engine/exporters';
import {colors} from './theme/tokens';
const modes:RoleViewMode[]=['DEV','BA','TESTER','LOW_CODE'];
const modeLabels={DEV:'Lập trình',BA:'Nghiệp vụ',TESTER:'Kiểm thử',LOW_CODE:'Low-Code'};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const string=(x:unknown):x is string=>typeof x==='string';
export function validGraph(value:unknown):value is FlowGraphPayload {
 if(!object(value)||!Array.isArray(value.nodes)||!Array.isArray(value.edges)||!Array.isArray(value.healthIssues)||!object(value.project)||value.nodes.length>10000)return false;
 const g={nodes:value.nodes,edges:value.edges,healthIssues:value.healthIssues},project=value.project;
 if(!['projectName','description','version','flutterSdkVersion','dartSdkConstraint'].every(k=>string(project[k]))||!object(project.stats)||!Object.values(project.stats).every(v=>typeof v==='number'&&Number.isFinite(v))||!Array.isArray(project.allDependencies)||!project.allDependencies.every(d=>object(d)&&string(d.name)&&string(d.version)))return false;
 const ids=new Set(g.nodes.map(n=>object(n)?n.id:undefined));
 return ids.size===g.nodes.length&&g.nodes.every(n=>object(n)&&string(n.id)&&string(n.kind)&&Object.hasOwn(colors,n.kind)&&string(n.featureGroup)&&string(n.technicalTitle)&&string(n.businessTitle)&&(!n.sourceLocation||(object(n.sourceLocation)&&string(n.sourceLocation.filePath)&&typeof n.sourceLocation.line==='number'&&string(n.sourceLocation.codeSnippet)))&&(!n.decisionInfo||(object(n.decisionInfo)&&Array.isArray(n.decisionInfo.branches)&&n.decisionInfo.branches.every(b=>object(b)&&string(b.branchId)&&string(b.technicalLabel)&&string(b.businessLabel))))&&(!n.apiInfo||(object(n.apiInfo)&&string(n.apiInfo.method)&&string(n.apiInfo.endpoint)))&&(!n.routeInfo||(object(n.routeInfo)&&string(n.routeInfo.routePath)))&&(!n.dialogInfo||(object(n.dialogInfo)&&string(n.dialogInfo.widgetName))))&&g.edges.every(e=>object(e)&&string(e.id)&&ids.has(e.source)&&ids.has(e.target))&&g.healthIssues.every(i=>object(i)&&['id','nodeId','title','suggestionForBA','suggestionForDev'].every(k=>string(i[k])));
}
function App(){
 const s=useFlowStore();
 const [token,setToken]=useState(''),[connectionToken,setConnectionToken]=useState<string|null>(null);
 const [search,setSearch]=useState(''),[feature,setFeature]=useState('all'),[fitKey,setFitKey]=useState(0);
 const [exportOpen,setExportOpen]=useState(false),[format,setFormat]=useState<Format|'png'|'svg'>('flow.json'),[scope,setScope]=useState('all'),[payload,setPayload]=useState(false),[light,setLight]=useState(false);
 const [notice,setNotice]=useState(''),[replay,setReplay]=useState<number|null>(null);
 const modal=useRef<HTMLDialogElement>(null),fileInput=useRef<HTMLInputElement>(null),closeDrawer=useRef<HTMLButtonElement>(null);
 const connect=useCallback((e:FormEvent)=>{e.preventDefault();if(token.trim())setConnectionToken(token.trim());},[token]);
 useEffect(()=>{
   if(!connectionToken)return;
   let disposed=false,socket:WebSocket|undefined,timer:ReturnType<typeof setTimeout>|undefined;
   async function start(){
     useFlowStore.setState({status:'Đang kết nối…'});
     try {
       const response=await fetch('/api/graph',{headers:{Authorization:`Bearer ${connectionToken}`}});
       if(!response.ok)throw Error(response.status===401?'Token không đúng. Sao chép token từ terminal CLI.':`Server trả lỗi ${response.status}. Kiểm tra CLI.`);
       const graph:unknown=await response.json();if(!validGraph(graph))throw Error('Graph không hợp lệ. Quét lại dự án từ CLI.');
       if(disposed)return;s.setGraph(graph);
       socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws?token=${encodeURIComponent(connectionToken!)}`);
       socket.onopen=()=>useFlowStore.setState({status:'Đã kết nối',error:''});
       socket.onmessage=e=>{try{const msg=JSON.parse(e.data);if(msg.type==='INITIAL_GRAPH'&&validGraph(msg.graph)){s.setGraph(msg.graph);for(const event of msg.history??[])s.receive(event);}else if(msg.type==='ERROR')useFlowStore.setState({error:msg.message});else if(['RUNTIME_STEP','SESSION_CONNECTED','SESSION_RESET'].includes(msg.type))s.receive(msg);}catch{useFlowStore.setState({error:'Bản tin không hợp lệ. Kiểm tra phiên bản runtime.'});}};
       socket.onclose=()=>{if(!disposed){useFlowStore.setState({status:'Mất kết nối · thử lại sau 2 giây'});timer=setTimeout(start,2000);}};
       socket.onerror=()=>socket?.close();
     }catch(error){if(!disposed)useFlowStore.setState({status:'Chưa kết nối',error:String(error)});}
   }
   void start();return()=>{disposed=true;clearTimeout(timer);socket?.close();};
 },[connectionToken]);
 useEffect(()=>{if(new URLSearchParams(location.search).has('demo'))fetch('/demo.flow.json').then(r=>r.json()).then(g=>{if(validGraph(g.graph??g)){s.setGraph(g.graph??g);useFlowStore.setState({status:'Đồ thị example · offline'});}}).catch(()=>setNotice('Không tải được đồ thị example. Chạy script tạo fixture.'));},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')s.select(null);if(e.altKey&&['1','2','3','4'].includes(e.key)){e.preventDefault();s.setMode(modes[Number(e.key)-1]);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 useEffect(()=>{if(s.selected)closeDrawer.current?.focus();},[s.selected]);
 useEffect(()=>{if(exportOpen)modal.current?.showModal();else modal.current?.close();},[exportOpen]);
 const graph=useMemo(()=>{
  if(!s.graph)return null;
  let g=s.mode==='LOW_CODE'?simplify(s.graph):s.graph;
  if(feature!=='all'){const nodes=g.nodes.filter(n=>n.featureGroup===feature);const ids=new Set(nodes.map(n=>n.id));g={...g,nodes,edges:g.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))};}
  return g;
 },[s.graph,s.mode,feature]);
 const confirmed=useMemo(()=>replay===null?s.confirmed:new Set(s.events.slice(0,replay+1).filter(e=>e.eventKind==='BRANCH_HIT'&&e.matchedNodeId&&e.matchedBranchId).map(e=>branchKey(e.matchedNodeId!,e.matchedBranchId!))),[replay,s.events,s.confirmed]);
 const replayActive=useMemo(()=>{
   if(replay===null||!s.graph)return s.active;
   const paths=new Set<string>(),previous:Record<string,string>={};
   for(const event of s.events.slice(0,replay+1)){const matched=matchEvent(s.graph,event);if(matched){if(previous[event.sessionId])for(const e of inferPath(s.graph,previous[event.sessionId],matched))paths.add(e);previous[event.sessionId]=matched;}}
   return paths;
 },[replay,s.graph,s.events,s.active]);
 const count=s.graph?coverage(s.graph,confirmed):null;
 const selected=s.graph?.nodes.find(n=>n.id===s.selected);
 async function exportNow(){
  if(!graph)return;
  if(payload&&!window.confirm('Snapshot có thể chứa dữ liệu API nhạy cảm. Bạn xác nhận đưa payload vào file?'))return;
  let exported=scope==='all'&&s.graph?s.graph:graph;
  if(scope==='active'){const edges=exported.edges.filter(e=>replayActive.has(e.id));const ids=new Set(edges.flatMap(e=>[e.source,e.target]));exported={...exported,nodes:exported.nodes.filter(n=>ids.has(n.id)),edges};}
  if(format==='png'||format==='svg'){
    try{const data=await imageData(exported,s.mode!=='DEV',light,format);const a=document.createElement('a');a.download=`flow.${format}`;a.href=data;a.click();}catch{setNotice('Không tạo được ảnh. Chọn SVG hoặc một cụm tính năng nhỏ hơn.');return;}
  }else download(serialize(exported,format,s.mode!=='DEV',safeEvents(s.events,payload)),`flow.${format}`);
  setExportOpen(false);
 }
 async function importSnapshot(file:File|undefined){
  if(!file)return;
  if(file.size>20*1024*1024){setNotice('File quá lớn. Chọn snapshot dưới 20 MiB.');return;}
  try{const data=JSON.parse(await file.text());if(!validGraph(data.graph))throw Error();s.reset();s.setGraph(data.graph);for(const event of Array.isArray(data.events)?data.events.slice(-2000):[])if(event&&typeof event.sessionId==='string'&&Number.isInteger(event.sequenceOrder))s.receive(event);setConnectionToken(null);useFlowStore.setState({status:'Snapshot · offline'});setNotice('Đã nhập snapshot.');}catch{setNotice('Snapshot không hợp lệ. Chọn file .flow.json xuất từ Studio.');}
 }
 return <div className="app">
 <header className="topbar"><a className="brand" href="#"><span className="brand-icon"><Activity size={22}/></span><span>FLOW<span className="brand-light">STUDIO</span><small>FLUTTER FLOW EXPLORER</small></span></a><nav aria-label="Góc nhìn" className="modes">{modes.map((m,i)=><button key={m} aria-pressed={s.mode===m} onClick={()=>s.setMode(m)} title={`Alt+${i+1}`}>{modeLabels[m]}</button>)}</nav><button onClick={()=>fileInput.current?.click()}><Upload size={16}/>Nhập</button><button className="primary" onClick={()=>setExportOpen(true)} disabled={!graph}><Download size={16}/>Export</button><input ref={fileInput} type="file" accept=".json" className="sr-only" aria-label="Nhập snapshot" onChange={e=>void importSnapshot(e.target.files?.[0])}/></header>
 <div className="statusbar"><span className="status-dot"/><span role="status">{s.status}</span><span>{s.events.at(-1)?.deviceName??'Chưa có thiết bị'}</span><span className="shortcut">Alt+1…4 đổi góc nhìn</span></div>
 <main className="workspace"><aside className="project-panel" aria-label="Dự án"><div className="project-identity"><p className="eyebrow">PROJECT OVERVIEW</p><h1>{s.graph?.project.projectName??'Khám phá luồng ứng dụng'}</h1><p className="muted">{s.graph?.project.description??'Kết nối CLI để xem kiến trúc và đường chạy của dự án Flutter.'}</p></div>
 <form onSubmit={connect} className="connect-form"><label htmlFor="token">Token từ terminal CLI</label><input id="token" type="password" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off"/><button type="submit">Kết nối<ArrowRight size={16}/></button></form>
 {s.graph&&<><div className="sdk"><span>Flutter {s.graph.project.flutterSdkVersion}</span><span>Dart {s.graph.project.dartSdkConstraint}</span></div><h2>Thành phần</h2><div className="stats">{Object.entries(s.graph.project.stats).map(([k,v])=><div key={k}><strong>{v}</strong><span>{k.replace('total','')}</span></div>)}</div>
 <label htmlFor="feature">Cụm tính năng</label><select id="feature" value={feature} onChange={e=>setFeature(e.target.value)}><option value="all">Toàn bộ dự án</option>{[...new Set(s.graph.nodes.map(n=>n.featureGroup))].map(f=><option key={f}>{f}</option>)}</select>
 {(s.mode==='BA'||s.mode==='DEV')&&<><h2>Kiểm toán luồng <span>{s.graph.healthIssues.length}</span></h2><ul className="issues">{s.graph.healthIssues.map(i=><li key={i.id}><button onClick={()=>s.select(i.nodeId)}>{i.title}</button><p>{s.mode==='DEV'?i.suggestionForDev:i.suggestionForBA}</p></li>)}</ul></>}
 <h2>Dependencies</h2><ul className="deps">{s.graph.project.allDependencies.map(d=><li key={d.name}><span>{d.name}</span><small>{d.version}</small></li>)}</ul></>}
 <div className="legend"><h2>Chú giải</h2>{Object.entries(colors).map(([k,v])=><div key={k}><span style={{background:v}}/>{k}</div>)}<p>Tested ✓: probe xác nhận<br/>Inferred: suy luận, không tính độ phủ<br/>Untested: chưa có bằng chứng</p></div></aside>
 <section className="graph-area" aria-label="Studio"><div className="canvas-toolbar"><label className="search"><Search size={16}/><input aria-label="Tìm node" placeholder="Tìm màn hình, hành động…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Xóa tìm kiếm" onClick={()=>setSearch('')}><X size={16}/></button>}</label><button onClick={()=>setFitKey(k=>k+1)}><Maximize size={16}/>Vừa khung</button></div>
 {(s.error||notice)&&<div className="notice" role="alert">{notice||s.error}<button aria-label="Đóng thông báo" onClick={()=>{setNotice('');useFlowStore.setState({error:''});}}><X size={16}/></button></div>}
 {s.mode==='TESTER'&&count&&<section className="coverage" aria-label="Độ phủ nhánh"><strong>Branch Coverage</strong><span>{count.tested} / {count.total} Tested {count.percent===null?'':`(${count.percent}%)`}</span><p>Chỉ tính BRANCH_HIT đã xác nhận. Đường suy luận có nhãn Inferred.</p><progress aria-label="Nhánh đã kiểm thử" value={count.tested} max={Math.max(1,count.total)}/></section>}
 {graph&&graph.nodes.length>0?<ReactFlowProvider><FlowCanvas graph={graph} mode={s.mode} active={replayActive} inferred={replay===null?s.inferred:replayActive} confirmed={confirmed} search={search} selected={s.selected} onSelect={s.select} fitKey={fitKey}/></ReactFlowProvider>:<div className="empty"><GitBranchIcon/><h2>{graph?'Chưa tìm thấy luồng':'Hiểu ứng dụng, từ đầu đến cuối'}</h2><p>{graph?'Kiểm tra lib/ và các điểm điều hướng, API hoặc dialog.':'Chạy dart run flutter_flow_studio trong dự án, rồi nhập token từ terminal.'}</p></div>}
 <section className="timeline" aria-label="Lịch sử thực thi"><div><strong>LIVE TIMELINE</strong><span>{s.events.length} bước</span><button onClick={()=>{if(window.confirm('Xóa đường chạy và độ phủ đang xem?')){s.reset();setReplay(null);}}}><RotateCcw size={14}/>Reset</button></div>{s.events.length>0?<><input type="range" min="0" max={s.events.length-1} value={replay??s.events.length-1} aria-label="Tua lại bước thực thi" onChange={e=>setReplay(Number(e.target.value))}/><p>{s.events[replay??s.events.length-1]?.eventKind} · {s.events[replay??s.events.length-1]?.routeName??s.events[replay??s.events.length-1]?.apiDetails?.url??'Sự kiện runtime'} <button onClick={()=>setReplay(null)}>Về trực tiếp</button></p></>:<p>Thao tác trên ứng dụng để nhận sự kiện tại đây.</p>}</section>
 </section>
 {selected&&<aside className="inspector" aria-label="Chi tiết node"><button ref={closeDrawer} className="close" aria-label="Đóng chi tiết" onClick={()=>s.select(null)}><X/></button><p className="eyebrow">NODE INSPECTOR</p><h2>{s.mode==='DEV'?selected.technicalTitle:selected.businessTitle}</h2><p>{selected.kind} · {selected.featureGroup}</p>{selected.sourceLocation&&<><p>{selected.sourceLocation.filePath}:{selected.sourceLocation.line}</p><pre tabIndex={0}>{selected.sourceLocation.codeSnippet}</pre><a className="button" href={`vscode://file/${encodeURIComponent(selected.sourceLocation.filePath)}:${selected.sourceLocation.line}`}>Open in VS Code</a><a className="button" href={`cursor://file/${encodeURIComponent(selected.sourceLocation.filePath)}:${selected.sourceLocation.line}`}>Open in Cursor</a></>}{selected.apiInfo&&<pre>{JSON.stringify(selected.apiInfo,null,2)}</pre>}<h3>ID dùng với FlowProbe</h3><code className="node-id">{selected.id}</code></aside>}
 </main><footer><span>LOCAL FIRST · Không telemetry</span><a href="https://github.com/qualife1291/flutter_flow_studio#readme" target="_blank" rel="noreferrer">Hướng dẫn</a><a href="https://github.com/qualife1291/flutter_flow_studio/blob/main/docs/limitations.md" target="_blank" rel="noreferrer">Giới hạn đã biết</a></footer>
 <dialog ref={modal} onCancel={()=>setExportOpen(false)} onClose={()=>setExportOpen(false)} aria-labelledby="export-title"><div className="modal-header"><h2 id="export-title">Xuất bản đồ luồng</h2><button aria-label="Đóng export" onClick={()=>setExportOpen(false)}><X/></button></div><label htmlFor="format">Định dạng</label><select id="format" value={format} onChange={e=>setFormat(e.target.value as typeof format)}>{['flow.json','drawio','mmd','excalidraw','puml','png','svg'].map(f=><option key={f}>{f}</option>)}</select><label htmlFor="scope">Phạm vi</label><select id="scope" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Toàn bộ dự án</option><option value="feature">Cụm tính năng đang chọn</option><option value="active">Đường chạy đang xem</option></select><p>Nhãn theo góc nhìn: {modeLabels[s.mode]}</p><label className="check"><input type="checkbox" checked={payload} onChange={e=>setPayload(e.target.checked)}/>Kèm payload API (cần xác nhận)</label><label className="check"><input type="checkbox" checked={light} onChange={e=>setLight(e.target.checked)}/>Nền sáng khi xuất ảnh</label><button className="primary" onClick={()=>void exportNow()}>Tải file</button></dialog>
 </div>;
}
function GitBranchIcon(){return <Activity size={48} aria-hidden="true"/>;}
export default App;
