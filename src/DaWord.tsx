import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Check, FilePlus2, FileText, FolderOpen, Highlighter, Italic, List, ListOrdered, Minus, Printer, Redo2, Strikethrough, Underline, Undo2, Download, Plus, Search, Type, X } from 'lucide-react';

type WordDoc = { id: string; title: string; content: string; updatedAt: number };
type DaWordFile = { id: string; name: string; kind: 'file'|'note'; location: string; mime?: string; data?: string; createdAt: number };
type DaWordProps = { files: DaWordFile[]; onSaveDocument: (file: DaWordFile) => void; fileId?: string };
const starterContent = '<h1>Welcome to DaWord</h1><p>Your ideas deserve a proper page.</p><p>Start writing here. Your document saves automatically in this browser.</p><p><br></p><h2>Make it yours</h2><p>Use the ribbon above to format text, add lists, change alignment, or insert a table. When you are ready, download a copy or print it to PDF.</p>';

function readDocuments(files: DaWordFile[]): WordDoc[] {
  const saved = files.filter(file => file.mime === 'application/x-daword' && typeof file.data === 'string').map(file => ({
    id: file.id, title: file.name.replace(/\.daword$/i, ''), content: file.data || '<p><br></p>', updatedAt: file.createdAt
  }));
  return saved.length ? saved : [{ id: 'doc-welcome', title: 'Welcome to DaWord', content: starterContent, updatedAt: Date.now() }];
}
function cleanFilename(value: string) { return value.trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 90) || 'Untitled document'; }

export default function DaWord({ files, onSaveDocument, fileId }: DaWordProps) {
  const [documents, setDocuments] = useState<WordDoc[]>(() => readDocuments(files));
  const [activeId, setActiveId] = useState(() => fileId || readDocuments(files)[0]?.id || 'doc-welcome');
  const [tab, setTab] = useState<'Home'|'Insert'|'Layout'|'View'>('Home');
  const [zoom, setZoom] = useState(100);
  const [savedAt, setSavedAt] = useState(Date.now());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showDocs, setShowDocs] = useState(false);
  const [pageWidth, setPageWidth] = useState<'page'|'wide'>('page');
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const active = documents.find(doc => doc.id === activeId) || documents[0];
  const wordCount = useMemo(() => {
    const text = (active?.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [active?.content]);
  const charCount = useMemo(() => (active?.content || '').replace(/<[^>]*>/g, '').length, [active?.content]);

  useEffect(() => {
    if (files.some(file => file.mime === 'application/x-daword')) setDocuments(readDocuments(files));
    if (fileId) setActiveId(fileId);
  }, [files, fileId]);
  useEffect(() => {
    if (editorRef.current && active && editorRef.current.innerHTML !== active.content) editorRef.current.innerHTML = active.content;
    if (titleRef.current && active && titleRef.current.value !== active.title) titleRef.current.value = active.title;
  }, [activeId]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 's') { event.preventDefault(); downloadDocument('html'); }
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
    onSaveDocument({ id: updated.id, name: cleanFilename(updated.title) + '.daword', kind: 'file', location: 'Documents', mime: 'application/x-daword', data: updated.content, createdAt: updated.updatedAt });
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
    setDocuments(old => [doc, ...old]); onSaveDocument({ id, name: 'Untitled document.daword', kind: 'file', location: 'Documents', mime: 'application/x-daword', data: doc.content, createdAt: doc.updatedAt }); setActiveId(id); setShowDocs(false); setTab('Home');
    window.setTimeout(() => editorRef.current?.focus(), 50);
  }
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
  function insertTable() {
    const rows = Array.from({ length: 3 }, (_, i) => '<tr>' + Array.from({ length: 3 }, () => '<td>' + (i === 0 ? '<strong>Heading</strong>' : '<br>') + '</td>').join('') + '</tr>').join('');
    insertHtml('<table style="border-collapse:collapse;width:100%;margin:12px 0" border="1"><tbody>' + rows + '</tbody></table><p><br></p>');
  }
  function updateTitle(value: string) { patchActive({ title: value || 'Untitled document' }); }
  if (!active) return null;

  const tool = (label: string, icon: ReactNode, onClick: () => void, activeState = false) => <button type="button" className={'dw-tool' + (activeState ? ' is-active' : '')} title={label} aria-label={label} onMouseDown={e => e.preventDefault()} onClick={onClick}>{icon}</button>;
  const menuButton = (label: string, action: () => void) => <button type="button" className="dw-menu-button" onClick={action}>{label}</button>;

  return <div className="daword-shell">
    <header className="dw-titlebar">
      <div className="dw-app-mark"><FileText size={22}/></div>
      <div className="dw-titleblock"><strong>DaWord</strong><span>Documents, made yours</span></div>
      <div className="dw-document-name"><FileText size={15}/><input ref={titleRef} key={active.id} defaultValue={active.title} aria-label="Document title" onChange={e => updateTitle(e.target.value)} /><span className="dw-save-state"><Check size={13}/> Saved</span></div>
      <div className="dw-title-actions">
        <button type="button" title="New document" onClick={newDocument}><FilePlus2 size={17}/><span>New</span></button>
        <button type="button" title="Open documents" onClick={() => setShowDocs(v => !v)}><FolderOpen size={17}/><span>Open</span></button>
        <button type="button" title="Download as HTML" onClick={() => downloadDocument('html')}><Download size={17}/><span>Export</span></button>
      </div>
    </header>
    <nav className="dw-tabs" aria-label="Ribbon tabs">{(['Home','Insert','Layout','View'] as const).map(item => <button type="button" key={item} className={tab===item?'active':''} onClick={() => setTab(item)}>{item}</button>)}<div className="dw-tabs-spacer"/><button type="button" className="dw-search-toggle" onClick={() => setSearchOpen(v => !v)}><Search size={15}/> Find</button></nav>
    <section className="dw-ribbon">
      {tab === 'Home' && <>
        <div className="dw-ribbon-group"><div className="dw-tool-row">{tool('Undo',<Undo2 size={17}/>,()=>runCommand('undo'))}{tool('Redo',<Redo2 size={17}/>,()=>runCommand('redo'))}<span className="dw-tool-divider"/><select aria-label="Text style" title="Text style" defaultValue="P" onChange={e=>runCommand('formatBlock',e.target.value)}><option value="P">Normal</option><option value="H1">Title</option><option value="H2">Heading 1</option><option value="H3">Heading 2</option><option value="BLOCKQUOTE">Quote</option></select><select aria-label="Font family" title="Font family" defaultValue="Arial" onChange={e=>runCommand('fontName',e.target.value)}><option>Arial</option><option>Calibri</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option></select><select aria-label="Font size" title="Font size" defaultValue="3" onChange={e=>runCommand('fontSize',e.target.value)}><option value="2">10</option><option value="3">12</option><option value="4">14</option><option value="5">18</option><option value="6">24</option><option value="7">36</option></select></div><div className="dw-tool-row">{tool('Bold',<Bold size={17}/>,()=>runCommand('bold'))}{tool('Italic',<Italic size={17}/>,()=>runCommand('italic'))}{tool('Underline',<Underline size={17}/>,()=>runCommand('underline'))}{tool('Strikethrough',<Strikethrough size={17}/>,()=>runCommand('strikeThrough'))}{tool('Text colour',<Type size={17}/>,()=>{const color=window.prompt('Text colour (hex, for example #1d4ed8):','#2563eb');if(color&&/^#[0-9a-f]{6}$/i.test(color))runCommand('foreColor',color)})}{tool('Highlight',<Highlighter size={17}/>,()=>runCommand('hiliteColor','#fff19a'))}<span className="dw-tool-divider"/>{tool('Bulleted list',<List size={17}/>,()=>runCommand('insertUnorderedList'))}{tool('Numbered list',<ListOrdered size={17}/>,()=>runCommand('insertOrderedList'))}<span className="dw-tool-divider"/>{tool('Align left',<AlignLeft size={17}/>,()=>runCommand('justifyLeft'))}{tool('Align centre',<AlignCenter size={17}/>,()=>runCommand('justifyCenter'))}{tool('Align right',<AlignRight size={17}/>,()=>runCommand('justifyRight'))}</div><small>Font &amp; paragraph</small></div>
        <div className="dw-ribbon-group dw-ribbon-quick">{menuButton('Clear formatting',()=>runCommand('removeFormat'))}{menuButton('Quote',()=>runCommand('formatBlock','BLOCKQUOTE'))}{menuButton('Page break',()=>insertHtml('<hr style="break-after:page;border:0;border-top:1px dashed #bbb;margin:24px 0"><p><br></p>'))}<small>Quick styles</small></div>
      </>}
      {tab === 'Insert' && <div className="dw-insert-grid">{menuButton('＋  Table 3 × 3',insertTable)}{menuButton('＋  Horizontal line',()=>insertHtml('<hr><p><br></p>'))}{menuButton('＋  Date',()=>insertHtml(new Date().toLocaleDateString()))}{menuButton('＋  Link',()=>{const url=window.prompt('Enter a web address','https://');if(url&&/^https?:\/\//i.test(url))runCommand('createLink',url)})}{menuButton('＋  Image',()=>{const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=()=>{const file=input.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>insertHtml('<img alt="" style="max-width:100%" src="'+String(reader.result)+'">');reader.readAsDataURL(file)};input.click()})}{menuButton('＋  Page number',()=>insertHtml('<span style="color:#777;font-size:10pt">Page number: 1</span>'))}</div>}
      {tab === 'Layout' && <div className="dw-insert-grid"><label className="dw-setting">Page width <select value={pageWidth} onChange={e=>setPageWidth(e.target.value as 'page'|'wide')}><option value="page">Standard page</option><option value="wide">Wide page</option></select></label>{menuButton('Landscape / wider feel',()=>setPageWidth(v=>v==='page'?'wide':'page'))}{menuButton('Page margins',()=>window.alert('DaWord uses comfortable print margins. Use your browser print dialog for paper-specific settings.'))}</div>}
      {tab === 'View' && <div className="dw-insert-grid"><label className="dw-setting">Zoom <select value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={75}>75%</option><option value={90}>90%</option><option value={100}>100%</option><option value={110}>110%</option><option value={125}>125%</option><option value={150}>150%</option></select></label>{menuButton('−',()=>setZoom(v=>Math.max(75,v-5)))}{menuButton('＋',()=>setZoom(v=>Math.min(150,v+5)))}{menuButton('Print / Save PDF',()=>window.print())}</div>}
    </section>
    {searchOpen && <div className="dw-findbar"><Search size={15}/><input id="daword-find" value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="Find in this document"/><span>{searchText ? ((active.content.toLowerCase().split(searchText.toLowerCase()).length-1)+' match(es)') : 'Type to search'}</span><button type="button" onClick={()=>{setSearchOpen(false);setSearchText('')}}><X size={15}/></button></div>}
    {showDocs && <div className="dw-docs-overlay"><section className="dw-docs-panel"><header><div><strong>Open a document</strong><small>Your documents are saved in this browser.</small></div><button type="button" onClick={()=>setShowDocs(false)}><X size={17}/></button></header>{documents.map(doc=><button type="button" className={'dw-doc-entry'+(doc.id===activeId?' selected':'')} key={doc.id} onClick={()=>{setActiveId(doc.id);setShowDocs(false)}}><FileText size={21}/><span><strong>{doc.title}</strong><small>Edited {new Date(doc.updatedAt).toLocaleString()} · {doc.content.replace(/<[^>]*>/g,' ').trim().split(/\s+/).filter(Boolean).length} words</small></span>{doc.id===activeId?<Check size={16}/>:null}</button>)}<button type="button" className="dw-new-doc" onClick={newDocument}><Plus size={16}/> New document</button></section></div>}
    <main className="dw-workspace"><div className="dw-page-wrap"><article className={'dw-page '+(pageWidth==='wide'?'dw-page-wide':'')} style={{zoom:zoom/100}}><div ref={editorRef} className="dw-editor" contentEditable suppressContentEditableWarning spellCheck onInput={e=>patchActive({content:e.currentTarget.innerHTML})} onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();document.execCommand('insertHTML',false,'&nbsp;&nbsp;&nbsp;&nbsp;');if(editorRef.current)patchActive({content:editorRef.current.innerHTML})}}} aria-label="Document editor" data-placeholder="Start writing your document…"/></article></div></main>
    <footer className="dw-statusbar"><div><Check size={13}/><span>All changes saved locally</span><span className="dw-status-sep">•</span><span>{wordCount} words</span><span className="dw-status-sep">•</span><span>{charCount} characters</span></div><div><button type="button" onClick={()=>downloadDocument('txt')}>Download .txt</button><button type="button" onClick={()=>window.print()}><Printer size={14}/> Print</button><span>{zoom}%</span><button type="button" aria-label="Zoom out" onClick={()=>setZoom(v=>Math.max(75,v-5))}><Minus size={14}/></button><button type="button" aria-label="Zoom in" onClick={()=>setZoom(v=>Math.min(150,v+5))}><Plus size={14}/></button></div></footer>
  </div>;
}
