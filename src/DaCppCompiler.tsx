import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square, RotateCcw, Download, Upload, Plus, Trash2, Terminal, Code2, BookOpen, Search, FileCode2, ChevronDown, CheckCircle2, AlertCircle, LoaderCircle } from 'lucide-react'

type SourceFile = { id:string; name:string; content:string }
type Runtime = { language:string; version:string; aliases?:string[] }
type RunResult = { stdout?:string; stderr?:string; code?:number|null; signal?:string|null; output?:string; memory?:number|null; cpu_time?:number|null }
const WORKSPACE_KEY = 'ida-cpp-workspace-v1'
const STARTER = `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

int main() {
    std::string name;
    std::cout << "What is your name? ";
    if (std::getline(std::cin, name)) {
        std::cout << "Hello, " << name << "!\\n";
    }

    std::vector<int> numbers = {5, 2, 9, 1, 7};
    std::sort(numbers.begin(), numbers.end());
    std::cout << "Sorted numbers: ";
    for (int number : numbers) std::cout << number << " ";
    std::cout << "\\n";
    return 0;
}
`
const LIBRARIES = [
  { name:'C++ Standard Library', detail:'iostream, string, vector, map, set, algorithm, filesystem, chrono, random, regex, thread, and more', headers:['iostream','string','vector','array','algorithm','map','unordered_map','set','unordered_set','queue','stack','deque','list','numeric','cmath','limits','iomanip','sstream','fstream','filesystem','chrono','random','regex','thread','mutex','memory','optional','variant','tuple','functional','numeric','cassert'] },
  { name:'Boost', detail:'Not guaranteed in the hosted runner; depends on the selected compiler image', headers:['boost/asio.hpp','boost/algorithm/string.hpp','boost/filesystem.hpp'] },
  { name:'C headers', detail:'C-compatible standard headers available with most C++ toolchains', headers:['cstdio','cstdlib','cstring','ctime','cmath','cstdint','climits'] },
]
const STARTER_TEMPLATES = [
  {name:'Console app',code:STARTER},
  {name:'Hello world',code:'#include <iostream>\n\nint main() {\n    std::cout << "Hello, IDA OS!\\n";\n    return 0;\n}\n'},
  {name:'Vectors & algorithms',code:'#include <iostream>\n#include <vector>\n#include <algorithm>\n\nint main() {\n    std::vector<int> values{8, 3, 6, 1, 9};\n    std::sort(values.begin(), values.end());\n    for (int n : values) std::cout << n << " ";\n    std::cout << "\\n";\n}\n'},
  {name:'File I/O',code:'#include <iostream>\n#include <fstream>\n#include <string>\n\nint main() {\n    std::ofstream out("example.txt");\n    out << "Saved from a C++ program\\n";\n    out.close();\n    std::cout << "Wrote example.txt (temporary runner filesystem).\\n";\n}\n'},
]
const panel:React.CSSProperties={height:'100%',minHeight:0,display:'flex',flexDirection:'column',background:'#0b1020',color:'#e5eaf5',fontFamily:'Inter,Segoe UI,system-ui,sans-serif',fontSize:13}
const button:React.CSSProperties={display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,padding:'8px 11px',border:'1px solid #303b52',borderRadius:7,background:'#151e30',color:'#dbe7ff',cursor:'pointer',fontSize:12,fontWeight:650}
const field:React.CSSProperties={background:'#0d1423',border:'1px solid #2b3650',borderRadius:7,color:'#e5eaf5',padding:'8px 10px',outline:'none',font:'inherit',boxSizing:'border-box'}
export default function DaCppCompiler({ onSaveFile }: { onSaveFile?:(file:{name:string;content:string})=>void }) {
  const [files,setFiles]=useState<SourceFile[]>(()=>{try{const saved=JSON.parse(localStorage.getItem(WORKSPACE_KEY)||'null');if(Array.isArray(saved?.files)&&saved.files.length)return saved.files;return [{id:'main',name:'main.cpp',content:STARTER}]}catch{return [{id:'main',name:'main.cpp',content:STARTER}]}})
  const [activeId,setActiveId]=useState('main')
  const [stdin,setStdin]=useState('IDA')
  const [args,setArgs]=useState('')
  const [standard,setStandard]=useState('c++20')
  const [runtime,setRuntime]=useState<Runtime|null>(null)
  const [runtimeStatus,setRuntimeStatus]=useState<'loading'|'ready'|'offline'>('loading')
  const [running,setRunning]=useState(false)
  const [result,setResult]=useState<RunResult|null>(null)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [tab,setTab]=useState<'terminal'|'libraries'|'help'>('terminal')
  const [libraryQuery,setLibraryQuery]=useState('')
  const [showSettings,setShowSettings]=useState(false)
  const editorRef=useRef<HTMLTextAreaElement>(null)
  const active=files.find(f=>f.id===activeId)||files[0]
  useEffect(()=>{try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify({files,activeId,standard}))}catch{}},[files,activeId,standard])
  useEffect(()=>{let cancelled=false;fetch('https://emkc.org/api/v2/piston/runtimes').then(r=>{if(!r.ok)throw new Error('Compiler service unavailable');return r.json()}).then((items:Runtime[])=>{if(cancelled)return;const cpp=items.find(x=>x.language==='c++'||x.language==='cpp'||x.aliases?.includes('cpp'));if(cpp){setRuntime(cpp);setRuntimeStatus('ready')}else setRuntimeStatus('offline')}).catch(()=>{if(!cancelled)setRuntimeStatus('offline')});return()=>{cancelled=true}},[])
  const updateActive=(content:string)=>setFiles(old=>old.map(f=>f.id===activeId?{...f,content}:f))
  const addFile=()=>{const n=files.length+1;const file={id:'file-'+Date.now(),name:n===2?'utils.cpp':'source'+n+'.cpp',content:'#include <iostream>\n\nvoid helper() {\n    std::cout << "Hello from another source file!\\n";\n}\n'};setFiles(old=>[...old,file]);setActiveId(file.id);setNotice('New source file added. Note: the hosted runner accepts a single source file per run; combine files before running multi-file projects.')}
  const removeFile=(id:string)=>{if(files.length===1){setNotice('Keep at least one source file in the project.');return}const next=files.filter(f=>f.id!==id);setFiles(next);if(activeId===id)setActiveId(next[0].id)}
  const run=async()=>{if(running||!active)return;setRunning(true);setError('');setNotice('');setResult(null);setTab('terminal');try{const version=runtime?.version||'*';const response=await fetch('https://emkc.org/api/v2/piston/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'c++',version,files:[{name:active.name.endsWith('.cpp')?active.name:active.name+'.cpp',content:active.content}],stdin,args:args.trim()?args.trim().split(/\\s+/):[],compile_timeout:10000,run_timeout:5000,compile_memory_limit:-1})});if(!response.ok)throw new Error('The compiler service returned HTTP '+response.status+'. It may be busy or temporarily unavailable.');const data=await response.json();if(data.message)throw new Error(String(data.message));if(data.compile){setResult({stdout:data.run?.stdout||'',stderr:[data.compile.stderr,data.compile.output,data.run?.stderr].filter(Boolean).join('\\n'),code:data.run?.code??data.compile.code,output:data.compile.output});if(data.compile.code!==0){setError('Compilation failed. Check the compiler output below.')}else if(data.run?.code!==0)setError('Program finished with a non-zero exit code.')}else if(data.run){setResult(data.run);if(data.run.code!==0)setError('Program finished with a non-zero exit code.')}else throw new Error('Unexpected compiler response. Please try again.')}catch(e){setError(e instanceof Error?e.message:'Could not reach the C++ compiler. Check your connection and retry.')}finally{setRunning(false)}}
  const exportProject=()=>{const blob=new Blob([active.content],{type:'text/x-c++src;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=active.name;a.click();URL.revokeObjectURL(url);setNotice('Downloaded '+active.name)}
  const importFile=(file?:File)=>{if(!file)return;if(!/\\.(cpp|cc|cxx|h|hpp|hh|txt)$/i.test(file.name)){setNotice('Choose a C++ source or header file (.cpp, .hpp, .h, .cc, .cxx).');return}const reader=new FileReader();reader.onload=()=>{const id='import-'+Date.now();setFiles(old=>[...old,{id,name:file.name,content:String(reader.result||'')}]);setActiveId(id);setNotice('Imported '+file.name)};reader.readAsText(file)}
  const filteredLibraries=useMemo(()=>LIBRARIES.map(lib=>({...lib,headers:lib.headers.filter(h=>(h+' '+lib.name+' '+lib.detail).toLowerCase().includes(libraryQuery.toLowerCase()))})).filter(lib=>!libraryQuery||lib.headers.length||lib.name.toLowerCase().includes(libraryQuery.toLowerCase())),[libraryQuery])
  const insertAtCursor=(text:string)=>{const el=editorRef.current;if(!el){updateActive(active.content+'\\n'+text);return}const start=el.selectionStart,end=el.selectionEnd;const value=active.content.slice(0,start)+text+active.content.slice(end);updateActive(value);requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+text.length,start+text.length)})}
  return <div style={panel}>
    <header style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid #273149',background:'#10182a',flexWrap:'wrap'}}>
      <div style={{width:34,height:34,borderRadius:9,display:'grid',placeItems:'center',background:'linear-gradient(140deg,#4f8cff,#6d54de)',color:'#fff'}}><Code2 size={20}/></div>
      <div style={{minWidth:130,flex:1}}><strong style={{fontSize:15,letterSpacing:'-.02em'}}>Da C++ Studio</strong><div style={{fontSize:11,color:'#91a0bb',marginTop:3}}>Console compiler · C++17/20/23 · hosted sandbox</div></div>
      <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:runtimeStatus==='ready'?'#78e2b0':runtimeStatus==='loading'?'#e7c67a':'#ff9a9a'}}>{runtimeStatus==='ready'?<CheckCircle2 size={13}/>:runtimeStatus==='loading'?<LoaderCircle size={13}/>:<AlertCircle size={13}/>} {runtimeStatus==='ready'?'Compiler connected':runtimeStatus==='loading'?'Checking compiler…':'Compiler offline'}</span>
      <button style={{...button,background:'#257bff',borderColor:'#257bff',color:'#fff',padding:'9px 15px'}} onClick={()=>void run()} disabled={running||!active}><Play size={15} fill="currentColor"/>{running?'Running…':'Run C++'}</button>
      <button style={button} onClick={()=>setShowSettings(v=>!v)}><ChevronDown size={14}/> Run settings</button>
    </header>
    {showSettings&&<div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',padding:'10px 14px',background:'#0d1423',borderBottom:'1px solid #273149'}}><label style={{display:'flex',alignItems:'center',gap:7}}>Language standard <select style={field} value={standard} onChange={e=>setStandard(e.target.value)}>{['c++17','c++20','c++23','c++14','c++11'].map(v=><option key={v}>{v}</option>)}</select></label><label style={{display:'flex',alignItems:'center',gap:7,flex:1,minWidth:180}}>Program arguments <input style={{...field,flex:1,minWidth:100}} value={args} onChange={e=>setArgs(e.target.value)} placeholder='e.g. --verbose 42'/></label><span style={{fontSize:11,color:'#8998b3'}}>Runner: {runtime?.version||'auto'} · 5s execution limit</span></div>}
    <div style={{display:'flex',alignItems:'center',gap:4,padding:'7px 10px 0',background:'#10182a',borderBottom:'1px solid #273149',overflowX:'auto'}}>{files.map(file=><div key={file.id} style={{display:'flex',alignItems:'center',borderRadius:'7px 7px 0 0',background:file.id===activeId?'#0b1020':'transparent',border:file.id===activeId?'1px solid #33415d':'1px solid transparent',borderBottom:0}}><button onClick={()=>setActiveId(file.id)} style={{...button,background:'transparent',border:0,borderRadius:0,padding:'8px 10px',color:file.id===activeId?'#f3f6ff':'#8795ad'}}><FileCode2 size={13}/>{file.name}</button><button title={'Remove '+file.name} onClick={()=>removeFile(file.id)} style={{...button,background:'transparent',border:0,padding:'6px 7px'}}><Trash2 size={12}/></button></div>)}<button onClick={addFile} style={{...button,border:0,background:'transparent'}} title="New source file"><Plus size={15}/></button><span style={{flex:1}}/><label style={{...button,whiteSpace:'nowrap'}}><Upload size={13}/> Import<input type="file" accept=".cpp,.cc,.cxx,.h,.hpp,.hh,.txt" hidden onChange={e=>{importFile(e.target.files?.[0]);e.currentTarget.value=''}}/></label><button onClick={exportProject} style={button}><Download size={13}/> Export .cpp</button><button onClick={()=>{onSaveFile?.({name:active.name,content:active.content});setNotice('Saved source file into IDA Documents.')}} style={button}><FileCode2 size={13}/> Save to IDA</button></div>
    <div style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(220px,30%)',overflow:'hidden'}}>
      <section style={{minWidth:0,minHeight:0,display:'flex',flexDirection:'column',borderRight:'1px solid #273149'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 12px',background:'#0e1626',color:'#93a3bf',fontSize:11}}><span>{active.name} · {active.content.split('\\n').length} lines</span><span>UTF-8 · C++</span></div>
        <textarea ref={editorRef} spellCheck={false} autoCapitalize="off" autoCorrect="off" value={active.content} onChange={e=>updateActive(e.target.value)} onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();insertAtCursor('    ')}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();void run()}}} aria-label="C++ source editor" style={{flex:1,minHeight:180,width:'100%',resize:'none',boxSizing:'border-box',border:0,outline:0,padding:'16px 18px',background:'#0b1020',color:'#dce6fb',font:'13px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace',tabSize:4,whiteSpace:'pre',overflow:'auto'}}/>
        <div style={{display:'flex',gap:7,alignItems:'center',padding:'7px 12px',borderTop:'1px solid #273149',background:'#0e1626',color:'#7f8eaa',fontSize:11}}><span>{active.content.length} chars</span><span>·</span><span>Ctrl/⌘ + Enter to run</span><span style={{flex:1}}/><button style={{...button,padding:'4px 7px'}} onClick={()=>{updateActive(STARTER);setNotice('Restored the starter project.')}}><RotateCcw size={12}/> Reset</button></div>
      </section>
      <aside style={{minWidth:0,minHeight:0,display:'flex',flexDirection:'column',background:'#0e1524'}}>
        <nav style={{display:'flex',borderBottom:'1px solid #273149'}}>{([{id:'terminal',label:'Console',icon:<Terminal size={13}/>},{id:'libraries',label:'Libraries',icon:<BookOpen size={13}/>},{id:'help',label:'Help',icon:<Code2 size={13}/>} ] as const).map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{...button,flex:1,border:0,borderRadius:0,background:tab===t.id?'#17233a':'transparent',color:tab===t.id?'#dbe7ff':'#8291ac',padding:'10px 6px'}}>{t.icon}{t.label}</button>)}</nav>
        {tab==='terminal'&&<div style={{flex:1,minHeight:0,overflow:'auto',padding:12,font:'12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}><div style={{color:'#7d8ca7',marginBottom:8}}>IDA C++ Console · standard input is editable above Run settings</div>{error&&<div style={{color:'#ff9e9e',marginBottom:9}}>{error}</div>}{result? <><div style={{color:'#8ce1b2'}}>$ {active.name} · exit code {result.code??'unknown'}</div>{result.stdout&&<div>{result.stdout}</div>}{result.stderr&&<div style={{color:'#ffbf8a',marginTop:6}}>{result.stderr}</div>}{!result.stdout&&!result.stderr&&<div style={{color:'#8b9ab4'}}>(no console output)</div>}{result.memory!=null&&<div style={{color:'#7d8ca7',marginTop:7}}>Memory: {result.memory} KB · CPU: {result.cpu_time??'—'} ms</div>}</>:<div style={{color:'#6f7e98'}}>Press Run C++ to compile and execute your console program.</div>}{notice&&<div style={{color:'#90baff',marginTop:10}}>{notice}</div>}</div>}
        {tab==='libraries'&&<div style={{flex:1,minHeight:0,overflow:'auto',padding:12}}><label style={{...field,display:'flex',alignItems:'center',gap:7}}><Search size={14}/><input value={libraryQuery} onChange={e=>setLibraryQuery(e.target.value)} placeholder="Search libraries and headers…" style={{border:0,outline:0,background:'transparent',color:'inherit',width:'100%',font:'inherit'}}/></label>{filteredLibraries.map(lib=><section key={lib.name} style={{marginTop:13,padding:10,border:'1px solid #2a354c',borderRadius:9}}><strong>{lib.name}</strong><p style={{margin:'6px 0 9px',color:'#94a3bc',lineHeight:1.5,fontSize:11}}>{lib.detail}</p><div style={{display:'flex',flexWrap:'wrap',gap:5}}>{lib.headers.map(h=><button key={h} style={{...button,padding:'4px 6px',fontSize:10}} title={'Insert #include <'+h+'>'} onClick={()=>{insertAtCursor('#include <'+h+'>\\n');setTab('terminal')}}>{h}</button>)}</div></section>)}</div>}
        {tab==='help'&&<div style={{flex:1,minHeight:0,overflow:'auto',padding:14,lineHeight:1.6,color:'#b8c5dc'}}><h3 style={{color:'#eef3ff',marginTop:0}}>C++ console apps</h3><p>Write a normal C++ program with <code>int main()</code>, then press Run C++ or Ctrl/⌘ + Enter.</p><label style={{display:'block',marginTop:12,marginBottom:5}}>Standard input (stdin)</label><textarea value={stdin} onChange={e=>setStdin(e.target.value)} placeholder="Text your program reads from std::cin" style={{...field,width:'100%',minHeight:85,resize:'vertical',fontFamily:'monospace'}}/><p>Text above is sent to <code>std::cin</code>. Use Run settings for command-line arguments. Programs run remotely in a restricted hosted environment, not on your device.</p><h4>Useful features</h4><ul style={{paddingLeft:18}}><li>Multiple editable source tabs (one file is sent to the hosted compiler per run).</li><li>Download source code or save it into IDA Documents.</li><li>Standard C++ headers and common library references.</li><li>Compiler output, runtime errors, stdin, and program arguments.</li></ul></div>}
      </aside>
    </div>
    <footer style={{display:'flex',gap:8,alignItems:'center',padding:'7px 12px',borderTop:'1px solid #273149',background:'#10182a',color:'#7f8eaa',fontSize:10,flexWrap:'wrap'}}><span>IDA OS · Da C++ Studio</span><span>•</span><span>Code runs on a third-party service; avoid secrets or personal data.</span><span style={{flex:1}}/><span>{standard.toUpperCase()}</span><span>·</span><span>Unsaved workspace autosaves locally</span></footer>
  </div>
}
