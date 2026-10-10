import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { askForChart, chartDataUri } from './chartUtils';
import { AlignCenter, AlignLeft, AlignRight, Bold, Check, FilePlus2, FileText, FolderOpen, Highlighter, Italic, List, ListOrdered, Minus, Printer, Redo2, Strikethrough, Underline, Undo2, Download, Plus, Search, Type, X, Trash2, Table2, Link2, ImagePlus, CalendarDays, Quote, Replace } from 'lucide-react';

type WordDoc = { id: string; title: string; content: string; updatedAt: number };
type DaWordFile = { id: string; name: string; kind: 'file'|'note'; location: string; mime?: string; data?: string; createdAt: number };
type DaWordProps = { files: DaWordFile[]; onSaveDocument: (file: DaWordFile) => void; onDeleteDocument?: (id:string) => void; fileId?: string };
const starterContent = '<p><br></p>';

function readDocuments(files: DaWordFile[]): WordDoc[] {
  const saved = files.filter(file => file.mime === 'application/x-daword' && typeof file.data === 'string').map(file => ({
    id: file.id, title: file.name.replace(/\.daword$/i, ''), content: file.data || '<p><br></p>', updatedAt: file.createdAt
  }));
  return saved.length ? saved : [{ id: 'doc-' + Date.now().toString(36), title: 'Untitled document', content: starterContent, updatedAt: Date.now() }];
}
function cleanFilename(value: string) { return value.trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 90) || 'Untitled document'; }

export default function DaWord({ files, onSaveDocument, onDeleteDocument, fileId }: DaWordProps) {
  const [documents, setDocuments] = useState<WordDoc[]>(() => readDocuments(files));
  const [activeId, setActiveId] = useState(() => fileId || readDocuments(files)[0]?.id || '');
  const launchBlankCreated=useRef(false); const manuallySelectedRef=useRef(false);
  const [tab, setTab] = useState<'Home'|'Insert'|'Layout'|'View'>('Home');
  const [zoom, setZoom] = useState(100);
  const [savedAt, setSavedAt] = useState(Date.now());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showDocs, setShowDocs] = useState(false); const [openSearch,setOpenSearch]=useState(''); const [templateOpen,setTemplateOpen]=useState(false); const [templateChoice,setTemplateChoice]=useState('Report'); const [saveAsOpen,setSaveAsOpen]=useState(false); const [saveAsTitle,setSaveAsTitle]=useState(''); const [saveAsLocation,setSaveAsLocation]=useState('Documents');
  const [pageWidth, setPageWidth] = useState<'page'|'wide'>('page');
  const [locked,setLocked]=useState(false); const [columns,setColumns]=useState(1); const [pageColor,setPageColor]=useState('#ffffff'); const [pageMargin,setPageMargin]=useState(48);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const active = documents.find(doc => doc.id === activeId) || documents[0];
  const wordCount = useMemo(() => {
    const text = (active?.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [active?.content]);
  const charCount = useMemo(() => (active?.content || '').replace(/<[^>]*>/g, '').length, [active?.content]);

  useEffect(() => {
    const shared = files.filter(file => file.mime === 'application/x-daword');
    if (shared.length) {
      setDocuments(readDocuments(files));
    } else {
      let legacy: WordDoc[] = [];
      try {
        const value = JSON.parse(localStorage.getItem('ida-daword-documents-v1') || 'null');
        if (Array.isArray(value)) legacy = value.filter(doc => doc && typeof doc.id === 'string' && typeof doc.content === 'string' && typeof doc.title === 'string');
      } catch {}
      const initial = legacy.length ? legacy : [];
      setDocuments(initial);
      if (!fileId) setActiveId(initial[0]?.id || '');
    }
    if (fileId && !manuallySelectedRef.current) setActiveId(fileId);

  }, [files, fileId]);
  useEffect(() => {
    if (editorRef.current && active && editorRef.current.innerHTML !== active.content) editorRef.current.innerHTML = active.content;
    if (titleRef.current && active && titleRef.current.value !== active.title) titleRef.current.value = active.title;
  }, [activeId]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 's') { event.preventDefault(); if (editorRef.current) patchActive({ content: editorRef.current.innerHTML }); }
      if (key === 'n') { event.preventDefault(); newDocument(); }
      if (key === 'p') { event.preventDefault(); window.print(); }
      if (key === 'f') { event.preventDefault(); setSearchOpen(true); window.setTimeout(() => document.getElementById('daword-find')?.focus(), 0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  function patchActive(patch: Partial<WordDoc>) {
    const current = documents.find(doc => doc.id === activeId) || documents[0];
    if (!current) return;
    const updated = { ...current, ...patch, updatedAt: Date.now() };
    setDocuments(old => old.some(doc => doc.id === activeId) ? old.map(doc => doc.id === activeId ? updated : doc) : [updated, ...old]);
    if (files.some(file=>file.id===updated.id)) onSaveDocument({ id: updated.id, name: cleanFilename(updated.title) + '.daword', kind: 'file', location: files.find(file=>file.id===updated.id)?.location||'Documents', mime: 'application/x-daword', data: updated.content, createdAt: updated.updatedAt });
    setSavedAt(Date.now());
  }
  function runCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) patchActive({ content: editorRef.current.innerHTML });
  }
  function insertHtml(html: string) {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    if (editorRef.current) patchActive({ content: editorRef.current.innerHTML });
  }
  function newDocument() {
    const id = 'doc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const doc = { id, title: 'Untitled document', content: '<p><br></p>', updatedAt: Date.now() };
    manuallySelectedRef.current=true; setDocuments(old => [doc, ...old]); setActiveId(id); setShowDocs(false); setTab('Home');
    window.setTimeout(() => editorRef.current?.focus(), 50);
  }
  function replaceText() { const find=window.prompt('Find text'); if(!find)return; const replacement=window.prompt('Replace with','')??''; const editor=editorRef.current;if(!editor)return;const html=editor.innerHTML.split(find).join(replacement);editor.innerHTML=html;patchActive({content:html}); }
  function downloadDocument(format: 'html'|'txt') {
    const title = cleanFilename(active?.title || 'Untitled document');
    const body = active?.content || '';
    const mime = format === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8';
    const payload = format === 'html' ? '<!doctype html><html><head><meta charset="utf-8"><title>' + title.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</title><style>body{max-width:760px;margin:60px auto;padding:0 24px;font:11pt/1.65 Calibri,Arial,sans-serif;color:#222}img{max-width:100%}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}</style></head><body>' + body + '</body></html>' : body.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const blob = new Blob([payload], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = title + (format === 'html' ? '.html' : '.txt'); a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportDocx() {
    const root=document.createElement('div'); root.innerHTML=editorRef.current?.innerHTML||active?.content||'';
    const children:Paragraph[]=[];
    const walk=(node:Node)=>{ if(node.nodeType===Node.TEXT_NODE){const t=node.textContent||'';if(t.trim())children.push(new Paragraph({children:[new TextRun(t)]}));return;} if(!(node instanceof HTMLElement))return;
      if(node.tagName==='BR'){children.push(new Paragraph(''));return;}
      if(['P','DIV','H1','H2','H3','LI','BLOCKQUOTE'].includes(node.tagName)){const text=node.innerText||node.textContent||'';const heading=node.tagName==='H1'?HeadingLevel.HEADING_1:node.tagName==='H2'?HeadingLevel.HEADING_2:node.tagName==='H3'?HeadingLevel.HEADING_3:undefined;children.push(new Paragraph({text,heading,bullet:node.tagName==='LI'?{indent:360}:undefined,spacing:{after:160}}));return;}
      Array.from(node.childNodes).forEach(walk);
    };
    Array.from(root.childNodes).forEach(walk); if(!children.length)children.push(new Paragraph(''));
    const doc=new Document({sections:[{children}]}); const blob=await Packer.toBlob(doc); const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=cleanFilename(active?.title||'Untitled document')+'.docx';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function insertChart() { const chart=askForChart(); if(!chart)return; insertHtml('<p><img alt="'+chart.title.replace(/["<>]/g,'')+'" style="max-width:100%;height:auto" src="'+chartDataUri(chart.svg)+'"></p><p><br></p>'); }
  function insertTable() {
    const rows = Array.from({ length: 3 }, (_, i) => '<tr>' + Array.from({ length: 3 }, () => '<td>' + (i === 0 ? '<strong>Heading</strong>' : '<br>') + '</td>').join('') + '</tr>').join('');
    insertHtml('<table style="border-collapse:collapse;width:100%;margin:12px 0" border="1"><tbody>' + rows + '</tbody></table><p><br></p>');
  }
  function updateTitle(value: string) { patchActive({ title: value || 'Untitled document' }); }
  if (!active) return null;

  const tool = (label: string, icon: ReactNode, onClick: () => void, activeState = false) => <button type="button" className={'dw-tool' + (activeState ? ' is-active' : '')} title={label} aria-label={label} onMouseDown={e => e.preventDefault()} onClick={onClick}>{icon}</button>;
  const menuButton = (label: string, action: () => void) => { const l=label.toLowerCase(); const icon=l.includes('table')?<Table2 size={15}/>:l.includes('link')?<Link2 size={15}/>:l.includes('image')?<ImagePlus size={15}/>:l.includes('date')?<CalendarDays size={15}/>:l.includes('citation')||l.includes('footnote')||l.includes('quote')?<Quote size={15}/>:l.includes('find')||l.includes('replace')?<Replace size={15}/>:l.includes('print')||l.includes('pdf')?<Printer size={15}/>:<Plus size={15}/>; return <button type="button" className="dw-menu-button" onClick={action}>{icon}<span>{label.replace(/^＋\s*/, '')}</span></button>; };

  return <div className="daword-shell">
    <header className="dw-titlebar">
      <div className="dw-app-mark"><FileText size={22}/></div>
      <div className="dw-titleblock"><strong>DaWord</strong><span>Documents, made yours</span></div>
      <div className="dw-document-name"><FileText size={15}/><input ref={titleRef} key={active.id} defaultValue={active.title} aria-label="Document title" onChange={e => updateTitle(e.target.value)} /><span className="dw-save-state"><Check size={13}/> {locked?'Read-only':'Saved'}</span></div>
      <div className="dw-title-actions">
        <button type="button" title="New document" onClick={newDocument}><FilePlus2 size={17}/><span>New</span></button>
        <button type="button" title="Open documents" onClick={() => setShowDocs(v => !v)}><FolderOpen size={17}/><span>Open</span></button><button type="button" title="Templates" onClick={()=>setTemplateOpen(true)}><FileText size={17}/><span>Templates</span></button><button type="button" title="Save a copy" onClick={()=>{setSaveAsTitle((active?.title||"Untitled document")+" copy");setSaveAsLocation("Documents");setSaveAsOpen(true)}}><Download size={17}/><span>Save as</span></button><button type="button" title="Save a copy" onClick={()=>{setSaveAsTitle((active?.title||"Untitled document")+" copy");setSaveAsLocation("Documents");setSaveAsOpen(true)}}><Download size={17}/><span>Save as</span></button>
        <button type="button" title="Export Word document" onClick={() => void exportDocx()}><Download size={17}/><span>DOCX</span></button><button type="button" title="Download as HTML" onClick={() => downloadDocument('html')}><Download size={17}/><span>HTML</span></button>
      </div>
    </header>
    <nav className="dw-tabs" aria-label="Ribbon tabs">{(['Home','Insert','Layout','View'] as const).map(item => <button type="button" key={item} className={tab===item?'active':''} onClick={() => setTab(item)}>{item}</button>)}<div className="dw-tabs-spacer"/><button type="button" className="dw-search-toggle" onClick={() => setSearchOpen(v => !v)}><Search size={15}/> Find</button></nav>
    <section className="dw-ribbon">
      {tab === 'Home' && <>
        <div className="dw-ribbon-group"><div className="dw-tool-row">{tool('Undo',<Undo2 size={17}/>,()=>runCommand('undo'))}{tool('Redo',<Redo2 size={17}/>,()=>runCommand('redo'))}<span className="dw-tool-divider"/><select aria-label="Text style" title="Text style" defaultValue="P" onChange={e=>runCommand('formatBlock',e.target.value)}><option value="P">Normal</option><option value="H1">Title</option><option value="H2">Heading 1</option><option value="H3">Heading 2</option><option value="BLOCKQUOTE">Quote</option></select><select aria-label="Font family" title="Font family" defaultValue="Arial" onChange={e=>runCommand('fontName',e.target.value)}><option>Arial</option><option>Aptos</option><option>Calibri</option><option>Cambria</option><option>Comic Sans MS</option><option>Georgia</option><option>Inter</option><option>Tahoma</option><option>Times New Roman</option><option>Trebuchet MS</option><option>Verdana</option><option>Courier New</option></select><select aria-label="Font size" title="Font size" defaultValue="16" onChange={e=>{const px=Number(e.target.value);const selection=window.getSelection();const editor=editorRef.current;if(selection&&selection.rangeCount&&editor&&selection.anchorNode&&editor.contains(selection.anchorNode)){const range=selection.getRangeAt(0);if(!range.collapsed){const span=document.createElement('span');span.style.fontSize=px+'px';try{span.appendChild(range.extractContents());range.insertNode(span);selection.removeAllRanges();const nextRange=document.createRange();nextRange.selectNodeContents(span);selection.addRange(nextRange)}catch{document.execCommand('fontSize',false,'7');editor.querySelectorAll('font[size="7"]').forEach(node=>{(node as HTMLElement).removeAttribute('size');(node as HTMLElement).style.fontSize=px+'px'})}patchActive({content:editor.innerHTML})}}}}><option value="13">10 pt</option><option value="16">12 pt</option><option value="19">14 pt</option><option value="24">18 pt</option><option value="32">24 pt</option><option value="48">36 pt</option><option value="64">48 pt</option></select></div><div className="dw-tool-row">{tool('Bold',<Bold size={17}/>,()=>runCommand('bold'))}{tool('Italic',<Italic size={17}/>,()=>runCommand('italic'))}{tool('Underline',<Underline size={17}/>,()=>runCommand('underline'))}{tool('Strikethrough',<Strikethrough size={17}/>,()=>runCommand('strikeThrough'))}{tool('Text colour',<Type size={17}/>,()=>{const color=window.prompt('Text colour (hex, for example #1d4ed8):','#2563eb');if(color&&/^#[0-9a-f]{6}$/i.test(color))runCommand('foreColor',color)})}<label className="dw-color-picker" title="Choose any text colour">A <input aria-label="Custom text colour" type="color" defaultValue="#2563eb" onChange={e=>runCommand('foreColor',e.target.value)}/></label>{tool('Highlight',<Highlighter size={17}/>,()=>runCommand('hiliteColor','#fff19a'))}<label className="dw-color-picker" title="Choose highlight colour">▰ <input aria-label="Custom highlight colour" type="color" defaultValue="#fff19a" onChange={e=>runCommand('hiliteColor',e.target.value)}/></label>{tool('Superscript',<span style={{fontSize:12,fontWeight:700}}>x²</span>,()=>runCommand('superscript'))}{tool('Subscript',<span style={{fontSize:12,fontWeight:700}}>x₂</span>,()=>runCommand('subscript'))}<span className="dw-tool-divider"/>{tool('Bulleted list',<List size={17}/>,()=>runCommand('insertUnorderedList'))}{tool('Numbered list',<ListOrdered size={17}/>,()=>runCommand('insertOrderedList'))}<span className="dw-tool-divider"/>{tool('Align left',<AlignLeft size={17}/>,()=>runCommand('justifyLeft'))}{tool('Align centre',<AlignCenter size={17}/>,()=>runCommand('justifyCenter'))}{tool('Align right',<AlignRight size={17}/>,()=>runCommand('justifyRight'))}</div><small>Font &amp; paragraph</small></div>
        <div className="dw-ribbon-group dw-ribbon-quick">{menuButton('Clear formatting',()=>runCommand('removeFormat'))}{menuButton('Quote',()=>runCommand('formatBlock','BLOCKQUOTE'))}{menuButton('Page break',()=>insertHtml('<hr style="break-after:page;border:0;border-top:1px dashed #bbb;margin:24px 0"><p><br></p>'))}<small>Quick styles</small></div>
      </>}
      {tab === 'Insert' && <div className="dw-insert-grid">{menuButton('＋  Table 3 × 3',insertTable)}{menuButton('＋  Chart / graph',insertChart)}{menuButton('＋  Horizontal line',()=>insertHtml('<hr><p><br></p>'))}{menuButton('＋  Date',()=>insertHtml(new Date().toLocaleDateString()))}{menuButton('＋  Link',()=>{const url=window.prompt('Enter a web address','https://');if(url&&/^https?:\/\//i.test(url))runCommand('createLink',url)})}{menuButton('＋  Image',()=>{const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=()=>{const file=input.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>insertHtml('<img alt="" style="max-width:100%" src="'+String(reader.result)+'">');reader.readAsDataURL(file)};input.click()})}{menuButton('＋  Page number',()=>insertHtml('<span style="color:#777;font-size:10pt">Page number: 1</span>'))}{menuButton('Find & replace',replaceText)}{menuButton('Footnote',()=>insertHtml('<sup style="color:#2563eb">[1]</sup><p style="font-size:10pt;color:#64748b;border-top:1px solid #cbd5e1">[1] Footnote text</p>'))}{menuButton('Citation',()=>{const citation=window.prompt('Citation (author, title, year)','Author, Title, Year');if(citation)insertHtml('<span style="color:#475569">('+citation.replace(/</g,'&lt;').replace(/>/g,'&gt;')+')</span>')})}</div>}
      {tab === 'Layout' && <div className="dw-insert-grid"><label className="dw-setting">Page width <select value={pageWidth} onChange={e=>setPageWidth(e.target.value as 'page'|'wide')}><option value="page">Standard page</option><option value="wide">Wide page</option></select></label><label className="dw-setting">Columns <select value={columns} onChange={e=>setColumns(Number(e.target.value))}><option value={1}>One</option><option value={2}>Two</option><option value={3}>Three</option></select></label><label className="dw-setting">Margins <select value={pageMargin} onChange={e=>setPageMargin(Number(e.target.value))}><option value={24}>Narrow</option><option value={48}>Normal</option><option value={72}>Wide</option></select></label><label className="dw-setting">Page colour <input type="color" value={pageColor} onChange={e=>setPageColor(e.target.value)}/></label>{menuButton(locked?'Unlock editing':'Protect document',()=>setLocked(v=>!v))}{menuButton('Landscape / wider feel',()=>setPageWidth(v=>v==='page'?'wide':'page'))}</div>}
      {tab === 'View' && <div className="dw-insert-grid"><label className="dw-setting">Zoom <select value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={75}>75%</option><option value={90}>90%</option><option value={100}>100%</option><option value={110}>110%</option><option value={125}>125%</option><option value={150}>150%</option></select></label>{menuButton('−',()=>setZoom(v=>Math.max(75,v-5)))}{menuButton('＋',()=>setZoom(v=>Math.min(150,v+5)))}{menuButton('Print / Save PDF',()=>window.print())}</div>}
    </section>
    {searchOpen && <div className="dw-findbar"><Search size={15}/><input id="daword-find" value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="Find in this document"/><span>{searchText ? ((active.content.toLowerCase().split(searchText.toLowerCase()).length-1)+' match(es)') : 'Type to search'}</span><button type="button" onClick={()=>{setSearchOpen(false);setSearchText('')}}><X size={15}/></button></div>}
    {templateOpen&&<div className="office-open-backdrop"><section className="office-action-dialog"><h2>Document templates</h2><p>Choose a starter layout in DaWord.</p><select value={templateChoice} onChange={e=>setTemplateChoice(e.target.value)}><option>Letter</option><option>Report</option><option>Resume</option><option>Meeting</option></select><div className="office-action-buttons"><button onClick={()=>setTemplateOpen(false)}>Cancel</button><button className="office-action-primary" onClick={()=>{const bodies:Record<string,string>={Letter:"<h1>Letter title</h1><p>Date: "+new Date().toLocaleDateString()+"</p><p>Dear [Name],</p><p>Write your message here.</p><p>Sincerely,</p>",Report:"<h1>Report title</h1><h2>Executive summary</h2><p>Summarize the main findings.</p><h2>Background</h2><p>Provide context.</p><h2>Findings</h2><p>Describe evidence.</p><h2>Recommendations</h2><p>List next steps.</p>",Resume:"<h1>Your Name</h1><p>Email · Phone · City</p><h2>Professional summary</h2><p>Your profile…</p><h2>Experience</h2><p>Role · Company · Dates</p><h2>Education</h2><p>Degree · School</p><h2>Skills</h2><p>Skills…</p>",Meeting:"<h1>Meeting minutes</h1><p>Date: "+new Date().toLocaleDateString()+"</p><h2>Agenda</h2><ul><li>Topic one</li><li>Topic two</li></ul><h2>Discussion</h2><p>Notes…</p><h2>Action items</h2><ul><li>Task · Owner · Due date</li></ul>"};const id="doc-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);const doc={id,title:templateChoice,content:bodies[templateChoice],updatedAt:Date.now()};manuallySelectedRef.current=true;setDocuments(old=>[doc,...old]);setActiveId(id);setTemplateOpen(false);setTab("Home")}}>Use template</button></div></section></div>}
    {saveAsOpen&&<div className="office-open-backdrop"><section className="office-action-dialog"><h2>Save document as</h2><p>Choose a file name and where it belongs in IDA.</p><label>File name<input value={saveAsTitle} onChange={e=>setSaveAsTitle(e.target.value)} autoFocus/></label><label>Save in<select value={saveAsLocation} onChange={e=>setSaveAsLocation(e.target.value)}><option>Documents</option><option>Desktop</option><option>Pictures</option><option>Music</option><option>Videos</option></select></label><div className="office-action-buttons"><button onClick={()=>setSaveAsOpen(false)}>Cancel</button><button className="office-action-primary" onClick={()=>{if(!saveAsTitle.trim())return;const id="doc-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);const content=editorRef.current?.innerHTML||active?.content||"<p><br></p>";const doc={id,title:saveAsTitle.trim(),content,updatedAt:Date.now()};setDocuments(old=>[doc,...old]);setActiveId(id);onSaveDocument({id,name:cleanFilename(doc.title)+".daword",kind:"file",location:saveAsLocation,mime:"application/x-daword",data:content,createdAt:doc.updatedAt});setSaveAsOpen(false)}}>Save</button></div></section></div>}
    {showDocs && <div className="office-open-backdrop"><section className="office-open-dialog"><header className="office-open-heading"><div className="office-open-brand"><span className="office-open-appicon word"><FileText size={20}/></span><div><strong>Open document</strong><small>DaWord · IDA Documents</small></div></div><button className="office-open-close" type="button" aria-label="Close open dialog" onClick={()=>{setShowDocs(false);setOpenSearch('')}}><X size={18}/></button></header><label className="office-open-search"><Search size={17}/><input value={openSearch} onChange={e=>setOpenSearch(e.target.value)} placeholder="Search documents..." autoFocus/><span>{documents.filter(d=>d.title.toLowerCase().includes(openSearch.toLowerCase())).length}</span></label><div className="office-open-list">{documents.filter(d=>d.title.toLowerCase().includes(openSearch.toLowerCase())).map(doc=><div className={'office-open-item'+(doc.id===activeId?' is-current':'')} key={doc.id}><button type="button" className="office-open-file" onClick={()=>{manuallySelectedRef.current=true;setActiveId(doc.id);setShowDocs(false);setOpenSearch('')}}><span className="office-file-icon word"><FileText size={19}/></span><span className="office-file-details"><strong>{doc.title}</strong><small>{new Date(doc.updatedAt).toLocaleString()} · {doc.content.replace(/<[^>]*>/g,' ').trim().split(/\s+/).filter(Boolean).length} words</small></span>{doc.id===activeId&&<span className="office-open-current">Current</span>}</button><button type="button" className="office-open-delete" title="Move to Trash" aria-label={'Delete '+doc.title} onClick={()=>{if(!window.confirm('Move '+doc.title+' to Trash?'))return;onDeleteDocument?.(doc.id);setDocuments(old=>old.filter(item=>item.id!==doc.id));if(activeId===doc.id){const next=documents.find(item=>item.id!==doc.id);if(next)setActiveId(next.id);else newDocument()}}}><Trash2 size={16}/></button></div>)}{documents.filter(d=>d.title.toLowerCase().includes(openSearch.toLowerCase())).length===0&&<div className="office-open-empty"><span><FolderOpen size={25}/></span><strong>{openSearch?'No matching documents':'No documents yet'}</strong><small>{openSearch?'Try a different search term.':'Create a document to see it here.'}</small></div>}</div><footer className="office-open-footer"><span>{documents.length} document{documents.length===1?'':'s'} · Saved in Documents</span><button type="button" className="office-open-primary" onClick={()=>{newDocument();setOpenSearch('')}}><Plus size={16}/> New document</button></footer></section></div>}
    <main className="dw-workspace"><div className="dw-page-wrap"><article className={'dw-page '+(pageWidth==='wide'?'dw-page-wide':'')} style={{zoom:zoom/100,background:pageColor,padding:pageMargin}}><div ref={editorRef} className="dw-editor" contentEditable={!locked} suppressContentEditableWarning spellCheck style={{columnCount:columns,columnGap:'36px'}} onInput={e=>patchActive({content:e.currentTarget.innerHTML})} onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();document.execCommand('insertHTML',false,'&nbsp;&nbsp;&nbsp;&nbsp;');if(editorRef.current)patchActive({content:editorRef.current.innerHTML})}}} aria-label="Document editor" title="Spell-check is enabled. Right-click underlined words for correction suggestions." data-placeholder="Start writing your document…"/></article></div></main>
    <footer className="dw-statusbar"><div><Check size={13}/><span>All changes saved locally</span><span className="dw-status-sep">•</span><span>{wordCount} words</span><span className="dw-status-sep">•</span><span>{charCount} characters</span></div><div><button type="button" onClick={()=>downloadDocument('txt')}>Download .txt</button><button type="button" onClick={()=>window.print()}><Printer size={14}/> Print</button><span>{zoom}%</span><button type="button" aria-label="Zoom out" onClick={()=>setZoom(v=>Math.max(75,v-5))}><Minus size={14}/></button><button type="button" aria-label="Zoom in" onClick={()=>setZoom(v=>Math.min(150,v+5))}><Plus size={14}/></button></div></footer>
  </div>;
}
