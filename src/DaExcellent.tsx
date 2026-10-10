import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bold, Check, Download, FilePlus2, FileSpreadsheet, Italic, Plus, Printer, Search, Sigma, Underline } from 'lucide-react';

type Cell = { value: string; bold?: boolean; italic?: boolean; underline?: boolean; color?: string; fill?: string; fontFamily?: string; fontSize?: number; format?: 'general'|'currency'|'percent' };
type SheetData = { id: string; name: string; cells: Record<string, Cell> };
type Workbook = { id: string; title: string; sheets: SheetData[]; activeSheet: string; updatedAt: number };
type IdaFile = { id: string; name: string; kind: 'file'|'note'; location: string; mime?: string; data?: string; createdAt: number };
type Props = { files: IdaFile[]; fileId?: string; onSaveWorkbook: (file: IdaFile) => void };
const MIME = 'application/x-daexcellent';
const COLS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const ROWS = Array.from({ length: 50 }, (_, i) => i + 1);
const keyOf = (row: number, col: number) => COLS[col] + row;
const emptySheet = (): SheetData => ({ id: 'sheet-' + Date.now().toString(36), name: 'Sheet1', cells: {} });
const starter = (): Workbook => {
  const sheet = emptySheet();
  sheet.cells = {
    A1: { value: 'Item', bold: true, fill: '#dbeafe' }, B1: { value: 'Quantity', bold: true, fill: '#dbeafe' }, C1: { value: 'Unit price', bold: true, fill: '#dbeafe' }, D1: { value: 'Total', bold: true, fill: '#dbeafe' },
    A2: { value: 'Notebook' }, B2: { value: '4' }, C2: { value: '2.50', format: 'currency' }, D2: { value: '=B2*C2', format: 'currency' },
    A3: { value: 'Pens' }, B3: { value: '10' }, C3: { value: '0.80', format: 'currency' }, D3: { value: '=B3*C3', format: 'currency' },
    A4: { value: 'Folders' }, B4: { value: '3' }, C4: { value: '1.75', format: 'currency' }, D4: { value: '=B4*C4', format: 'currency' },
    C6: { value: 'Grand total', bold: true }, D6: { value: '=SUM(D2:D4)', bold: true, format: 'currency', fill: '#dcfce7' }
  };
  return { id: 'workbook-' + Date.now().toString(36), title: 'Budget workbook', sheets: [sheet], activeSheet: sheet.id, updatedAt: Date.now() };
};
const cleanName = (value: string) => value.trim().replaceAll(String.fromCharCode(92), '').replaceAll('/', '').replaceAll(':', '').replaceAll('*', '').replaceAll('?', '').replaceAll('"', '').replaceAll('<', '').replaceAll('>', '').replaceAll('|', '').slice(0, 80) || 'Untitled workbook';
function colIndex(name: string) { let n = 0; for (const ch of name) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
function numeric(value: string): number { const n = Number(value.replace(/[$,%]/g, '')); return Number.isFinite(n) ? n : 0; }
function evaluate(ref: string, sheet: SheetData, seen = new Set<string>()): string {
  const cell = sheet.cells[ref]; if (!cell || !cell.value) return '';
  const raw = cell.value.trim(); if (!raw.startsWith('=')) {
    if (cell.format === 'currency' && raw !== '' && Number.isFinite(Number(raw))) return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(raw));
    if (cell.format === 'percent' && raw !== '' && Number.isFinite(Number(raw))) return (Number(raw) * 100).toLocaleString() + '%';
    return raw;
  }
  if (seen.has(ref)) return '#CYCLE!'; seen.add(ref);
  const formula = raw.slice(1).trim();
  const parseRange = (address: string): string[] => {
    const m = address.trim().match(/^([A-Z]+)(\\d+):([A-Z]+)(\\d+)$/i);
    if (!m) return [address.trim().toUpperCase()];
    const [, ca, ra, cb, rb] = m;
    const values: string[] = [];
    for (let r = Math.min(Number(ra), Number(rb)); r <= Math.max(Number(ra), Number(rb)); r++) {
      for (let c = Math.min(colIndex(ca.toUpperCase()), colIndex(cb.toUpperCase())); c <= Math.max(colIndex(ca.toUpperCase()), colIndex(cb.toUpperCase())); c++) values.push(keyOf(r, c));
    }
    return values;
  };
  const rangeValues = (address: string): { raw: string; value: number }[] => parseRange(address).map(key => {
    const source = sheet.cells[key]?.value ?? '';
    const displayed = evaluate(key, sheet, new Set(seen));
    return { raw: source, value: numeric(displayed) };
  });
  const functionMatch = formula.match(/^([A-Z]+)\\((.*)\\)$/i);
  if (functionMatch) {
    const fn = functionMatch[1].toUpperCase();
    const args = functionMatch[2].split(',').map(x => x.trim());
    const isRange = (v: string) => /^[A-Z]+\\d+:[A-Z]+\\d+$/i.test(v);
    const vals = (arg: string) => rangeValues(arg);
    const numbers = (arg: string) => (isRange(arg) ? vals(arg) : [{ raw: arg, value: numeric(arg.startsWith('"') ? arg.slice(1,-1) : arg.startsWith('=') ? arg.slice(1) : arg) }]);
    const firstRange = args.find(isRange);
    if (['SUM','AVERAGE','MIN','MAX','COUNT','COUNTA','COUNTBLANK','PRODUCT','MEDIAN','STDEV','VAR'].includes(fn) && (firstRange || args.length)) {
      const all = args.flatMap(arg => isRange(arg) ? vals(arg) : numbers(arg));
      const ns = all.filter(v => v.raw.trim() !== '' && Number.isFinite(v.value)).map(v => v.value);
      if (fn === 'COUNT') return String(all.filter(v => v.raw.trim() !== '' && Number.isFinite(Number(v.raw))).length);
      if (fn === 'COUNTA') return String(all.filter(v => v.raw.trim() !== '').length);
      if (fn === 'COUNTBLANK') return String(all.filter(v => v.raw.trim() === '').length);
      if (fn === 'PRODUCT') return String(ns.reduce((a,b)=>a*b,1));
      if (!ns.length) return '0';
      if (fn === 'SUM') return String(ns.reduce((a,b)=>a+b,0));
      if (fn === 'AVERAGE') return String(ns.reduce((a,b)=>a+b,0)/ns.length);
      if (fn === 'MIN') return String(Math.min(...ns));
      if (fn === 'MAX') return String(Math.max(...ns));
      if (fn === 'MEDIAN') { const sorted=[...ns].sort((a,b)=>a-b); const mid=Math.floor(sorted.length/2); return String(sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2); }
      const mean=ns.reduce((a,b)=>a+b,0)/ns.length; const variance=ns.reduce((a,b)=>a+(b-mean)**2,0)/ns.length;
      return String(fn==='STDEV'?Math.sqrt(variance):variance);
    }
    if (fn === 'COUNTIF' && args.length >= 2 && isRange(args[0])) {
      const criterion=args.slice(1).join(',').replace(/^"|"$/g,'').toLowerCase();
      return String(vals(args[0]).filter(v => { const rawValue=v.raw.toLowerCase(); const op=criterion.match(/^(>=|<=|<>|>|<|=)(.*)$/); if(op){const rhs=op[2].replace(/^"|"$/g,'');const a=Number(rawValue),b=Number(rhs);if(Number.isFinite(a)&&Number.isFinite(b)){switch(op[1]){case '>':return a>b;case '<':return a<b;case '>=':return a>=b;case '<=':return a<=b;case '<>':return a!==b;default:return a===b}}return op[1]==='<'?rawValue<rhs:op[1]==='>'?rawValue>rhs:op[1]==='<> '?rawValue!==rhs:rawValue===rhs;} return rawValue===criterion; }).length);
    }
    if (fn === 'SUMIF' && args.length >= 2 && isRange(args[0])) {
      const criteria=args[1].replace(/^"|"$/g,'').toLowerCase(); const candidates=vals(args[0]); const sums=args[2]&&isRange(args[2])?vals(args[2]):candidates;
      return String(candidates.reduce((sum,v,i)=>sum+(v.raw.toLowerCase()===criteria?numeric(sums[i]?.raw||'0'):0),0));
    }
    const scalar = (arg: string): number => {
      const ref=arg.match(/^([A-Z]+\\d+)$/i);
      if(ref)return numeric(evaluate(ref[1].toUpperCase(),sheet,new Set(seen)));
      const n=Number(arg);return Number.isFinite(n)?n:0;
    };
    const a=scalar(args[0]||'0'), b=scalar(args[1]||'0');
    if(fn==='ABS')return String(Math.abs(a)); if(fn==='SQRT')return a<0?'#NUM!':String(Math.sqrt(a));
    if(fn==='POWER')return String(Math.pow(a,b)); if(fn==='MOD')return b===0?'#DIV/0!':String(a%b);
    if(fn==='INT')return String(Math.floor(a)); if(fn==='ROUND')return String(Number(a.toFixed(Math.max(-10,Math.min(10,b)))));
    if(fn==='ROUNDUP')return String(Math.sign(a)*Math.ceil(Math.abs(a)*10**b)/10**b);
    if(fn==='ROUNDDOWN')return String(Math.sign(a)*Math.floor(Math.abs(a)*10**b)/10**b);
    if(fn==='CEILING')return String(Math.ceil(a/(b||1))*(b||1)); if(fn==='FLOOR')return String(Math.floor(a/(b||1))*(b||1));
    if(fn==='LEN')return String((args[0]||'').replace(/^"|"$/g,'').length);
    if(fn==='UPPER')return (args[0]||'').replace(/^"|"$/g,'').toUpperCase();
    if(fn==='LOWER')return (args[0]||'').replace(/^"|"$/g,'').toLowerCase();
    if(fn==='TRIM')return (args[0]||'').replace(/^"|"$/g,'').trim().replace(/\\s+/g,' ');
    if(fn==='LEFT'||fn==='RIGHT'){const textValue=(args[0]||'').replace(/^"|"$/g,'');return fn==='LEFT'?textValue.slice(0,b||1):textValue.slice(- (b||1));}
    if(fn==='CONCAT'||fn==='CONCATENATE')return args.map(arg=>{const ref=arg.match(/^([A-Z]+\\d+)$/i);return ref?evaluate(ref[1].toUpperCase(),sheet,new Set(seen)):arg.replace(/^"|"$/g,'');}).join('');
  }
  const rangeMatch = formula.match(/^(SUM|AVERAGE|MIN|MAX|COUNT)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/i);
  if (rangeMatch) {
    const [, fn, c1, r1, c2, r2] = rangeMatch; const vals: number[] = [];
    for (let r = Math.min(Number(r1), Number(r2)); r <= Math.max(Number(r1), Number(r2)); r++) for (let c = Math.min(colIndex(c1.toUpperCase()), colIndex(c2.toUpperCase())); c <= Math.max(colIndex(c1.toUpperCase()), colIndex(c2.toUpperCase())); c++) {
      const v = evaluate(keyOf(r, c), sheet, new Set(seen)); if (v !== '' && Number.isFinite(Number(v.replace(/[$,%]/g, '')))) vals.push(numeric(v));
    }
    if (fn.toUpperCase() === 'COUNT') return String(vals.length);
    if (!vals.length) return '0';
    if (fn.toUpperCase() === 'SUM') return String(vals.reduce((a,b)=>a+b,0));
    if (fn.toUpperCase() === 'AVERAGE') return String(vals.reduce((a,b)=>a+b,0)/vals.length);
    if (fn.toUpperCase() === 'MIN') return String(Math.min(...vals));
    return String(Math.max(...vals));
  }
  const substituted = formula.replace(/([A-Z]+\d+)/gi, token => {
    const value = evaluate(token.toUpperCase(), sheet, new Set(seen));
    return value === '' || value.startsWith('#') ? '0' : String(numeric(value));
  });
  if (!/^[\d+*/().%\s-]+$/.test(substituted)) return '#VALUE!';
  try {
    const tokens = substituted.match(/\d+(?:\.\d+)?|[()+*/-]/g) || [];
    const output: string[] = []; const ops: string[] = []; const precedence: Record<string,number> = {'+':1,'-':1,'*':2,'/':2};
    for (const token of tokens) {
      if (/^\d/.test(token)) output.push(token);
      else if (token === '(') ops.push(token);
      else if (token === ')') { while (ops.length && ops[ops.length-1] !== '(') output.push(ops.pop()!); ops.pop(); }
      else { while (ops.length && precedence[ops[ops.length-1]] >= precedence[token]) output.push(ops.pop()!); ops.push(token); }
    }
    while (ops.length) output.push(ops.pop()!);
    const stack: number[] = [];
    for (const token of output) { if (/^\d/.test(token)) stack.push(Number(token)); else { const b=stack.pop()||0; const a=stack.pop()||0; stack.push(token==='+'?a+b:token==='-'?a-b:token==='*'?a*b:b===0?NaN:a/b); } }
    const result = stack[0]; return Number.isFinite(result) ? String(Number(result.toFixed(8))) : '#DIV/0!';
  } catch { return '#VALUE!'; }
}
function parseWorkbook(file?: IdaFile): Workbook | null {
  if (!file?.data) return null;
  try { const data = JSON.parse(file.data); if (data && Array.isArray(data.sheets) && data.sheets.length) return { ...data, id: file.id, title: file.name.replace(/\.daexcel$/i, '') }; } catch {}
  return null;
}
export default function DaExcellent({ files, fileId, onSaveWorkbook }: Props) {
  const initialFile = files.find(f => f.id === fileId && f.mime === MIME) || files.find(f => f.mime === MIME);
  const [book, setBook] = useState<Workbook>(() => parseWorkbook(initialFile) || starter());
  const [activeCell, setActiveCell] = useState('A1');
  const [editing, setEditing] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState<'Home'|'Insert'|'Formulas'|'View'>('Home');
  const [selectedSheet, setSelectedSheet] = useState(book.activeSheet);
  const [query, setQuery] = useState('');
  const [showFind, setShowFind] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState('All changes saved');
  const gridRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const sheet = book.sheets.find(s => s.id === selectedSheet) || book.sheets[0];
  const active = sheet.cells[activeCell] || { value: '' };
  const display = (ref: string) => { const raw = evaluate(ref, sheet); const cell = sheet.cells[ref]; if (cell?.value.trim().startsWith('=') && raw !== '' && !raw.startsWith('#') && Number.isFinite(Number(raw))) { if (cell.format === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(raw)); if (cell.format === 'percent') return (Number(raw) * 100).toLocaleString() + '%'; } return raw; };
  const save = (next: Workbook) => {
    const updated = { ...next, updatedAt: Date.now() }; setBook(updated); setStatus('Saving…');
    onSaveWorkbook({ id: updated.id, name: cleanName(updated.title) + '.daexcel', kind: 'file', location: 'Documents', mime: MIME, data: JSON.stringify(updated), createdAt: updated.updatedAt });
    setStatus('All changes saved');
  };
  useEffect(() => {
    const latest = files.filter(f => f.mime === MIME);
    const desired = latest.find(f => f.id === fileId) || latest[0];
    const parsed = parseWorkbook(desired);
    if (parsed && parsed.id !== book.id) { setBook(parsed); setSelectedSheet(parsed.activeSheet || parsed.sheets[0].id); }
    if (!desired) {
      const created = { ...book, id: book.id || 'workbook-' + Date.now().toString(36) };
      onSaveWorkbook({ id: created.id, name: cleanName(created.title) + '.daexcel', kind: 'file', location: 'Documents', mime: MIME, data: JSON.stringify(created), createdAt: Date.now() });
    }
  }, [files, fileId]);
  useEffect(() => { const c = book.sheets.find(s => s.id === selectedSheet)?.cells[activeCell]; setEditing(c?.value || ''); setEditMode(false); }, [activeCell, selectedSheet, book.id]);
  const sheetNames = book.sheets.map(s => s.name).join(', ');
  const nonEmpty = Object.values(sheet.cells).filter(c => c.value.trim()).length;
  const updateCell = (ref: string, patch: Partial<Cell>) => {
    const currentSheet = book.sheets.find(s => s.id === selectedSheet) || sheet;
    const nextSheet = { ...currentSheet, cells: { ...currentSheet.cells, [ref]: { ...(currentSheet.cells[ref] || { value: '' }), ...patch } } };
    save({ ...book, activeSheet: selectedSheet, sheets: book.sheets.map(s => s.id === selectedSheet ? nextSheet : s) });
  };
  const commitEdit = () => { updateCell(activeCell, { value: editing }); setEditMode(false); };
  const move = (dr: number, dc: number) => {
    const m = activeCell.match(/^([A-Z]+)(\d+)$/); if (!m) return;
    const row = Number(m[2]), col = colIndex(m[1]); const nr = Math.max(1, Math.min(ROWS.length, row + dr)), nc = Math.max(0, Math.min(COLS.length-1, col + dc));
    setActiveCell(keyOf(nr,nc)); gridRef.current?.querySelector<HTMLInputElement>('[data-cell="' + keyOf(nr,nc) + '"]')?.focus();
  };
  const addSheet = () => { const n=book.sheets.length+1; const s={...emptySheet(),name:'Sheet'+n}; const next={...book,sheets:[...book.sheets,s],activeSheet:s.id}; save(next); setSelectedSheet(s.id); setActiveCell('A1'); };
  const duplicateSheet = () => { const copy={...sheet,id:'sheet-'+Date.now().toString(36),name:(sheet.name+' copy').slice(0,31),cells:{...sheet.cells}};const next={...book,sheets:[...book.sheets,copy],activeSheet:copy.id};save(next);setSelectedSheet(copy.id);setActiveCell('A1'); };
  const newWorkbook = () => { const next = { ...starter(), title: 'Untitled workbook' }; setSelectedSheet(next.sheets[0].id); setActiveCell('A1'); save(next); };
  const format = (patch: Partial<Cell>) => updateCell(activeCell, patch);
  const exportCsv = () => {
    const used = Object.keys(sheet.cells).filter(k => sheet.cells[k]?.value).map(k => { const m=k.match(/^([A-Z]+)(\d+)$/)!; return { c:colIndex(m[1]), r:Number(m[2]) }; });
    const maxR = Math.max(1,...used.map(v=>v.r)), maxC = Math.max(0,...used.map(v=>v.c));
    const lines = Array.from({length:maxR},(_,ri)=>Array.from({length:maxC+1},(_,ci)=>{ const v=display(keyOf(ri+1,ci)); return '"' + v.replace(/"/g,'""') + '"'; }).join(','));
    const blob = new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=cleanName(book.title)+'.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const exportWorkbook = () => { const blob=new Blob([JSON.stringify(book,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=cleanName(book.title)+'.daexcellent.json'; a.click(); URL.revokeObjectURL(url); };
  const importFile = (file: File) => {
    const reader=new FileReader(); reader.onload=()=>{ const text=String(reader.result||''); const rows=text.replace(/\r/g,'').split('\n').filter(Boolean).map(line=>{ const out:string[]=[]; let value=''; let quoted=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'&&quoted&&line[i+1]==='"'){value+='"';i++;}else if(ch==='"')quoted=!quoted;else if(ch===','&&!quoted){out.push(value);value='';}else value+=ch;}out.push(value);return out;}); const s={...emptySheet(),name:'Imported data',cells:{} as Record<string,Cell>}; rows.slice(0,50).forEach((row,r)=>row.slice(0,26).forEach((value,c)=>{if(value!=='')s.cells[keyOf(r+1,c)]={value};})); save({...book,title:file.name.replace(/\.[^.]+$/,''),sheets:[s],activeSheet:s.id});setSelectedSheet(s.id);setActiveCell('A1');}; reader.readAsText(file);
  };
  const findNext = () => { if (!query) return; const entries=Object.entries(sheet.cells).sort((a,b)=>{const ma=a[0].match(/^([A-Z]+)(\d+)$/)!,mb=b[0].match(/^([A-Z]+)(\d+)$/)!;return Number(ma[2])-Number(mb[2])||colIndex(ma[1])-colIndex(mb[1]);}); const found=entries.find(([ref,cell])=>ref!==activeCell&&cell.value.toLowerCase().includes(query.toLowerCase())); if(found){setActiveCell(found[0]);gridRef.current?.querySelector<HTMLInputElement>('[data-cell="'+found[0]+'"]')?.focus();} else setStatus('No matches found'); };
  const actionButton = (label:string, icon:ReactNode, action:()=>void, activeState=false) => <button type="button" title={label} aria-label={label} className={'de-tool'+(activeState?' selected':'')} onClick={action}>{icon}</button>;
  return <div className="daexcellent">
    <header className="de-titlebar">
      <div className="de-appmark"><FileSpreadsheet size={23}/></div>
      <div className="de-brand"><strong>DaExcellent</strong><span>Spreadsheets, made simple</span></div>
      <div className="de-bookname"><FileSpreadsheet size={16}/><input aria-label="Workbook name" value={book.title} onChange={e=>save({...book,title:e.target.value||'Untitled workbook'})}/><Check size={14}/></div>
      <div className="de-title-actions"><button onClick={newWorkbook}><FilePlus2 size={16}/> New</button><button onClick={()=>save(book)}><Check size={16}/> Save</button><button onClick={exportCsv}><Download size={16}/> Export CSV</button><button onClick={()=>window.print()}><Printer size={16}/> Print</button></div>
    </header>
    <nav className="de-tabs">{(['Home','Insert','Formulas','View'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}<span className="de-tabs-spacer"/><button onClick={()=>setShowFind(v=>!v)}><Search size={14}/> Find</button></nav>
    <section className="de-ribbon">
      {tab==='Home'&&<><div className="de-group"><div className="de-tools">{actionButton('Bold',<Bold size={16}/>,()=>format({bold:!active.bold}),!!active.bold)}{actionButton('Italic',<Italic size={16}/>,()=>format({italic:!active.italic}),!!active.italic)}{actionButton('Underline',<Underline size={16}/>,()=>format({underline:!active.underline}),!!active.underline)}<label className="de-color-control" title="Custom text colour">A <input aria-label="Custom font colour" type="color" value={active.color||'#202938'} onChange={e=>format({color:e.target.value})}/></label><label className="de-color-control" title="Custom cell fill">▰ <input aria-label="Custom cell fill" type="color" value={active.fill||'#ffffff'} onChange={e=>format({fill:e.target.value})}/></label><select aria-label="Font family" value={active.fontFamily||'Arial'} onChange={e=>format({fontFamily:e.target.value})}><option>Arial</option><option>Calibri</option><option>Georgia</option><option>Inter</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option></select><select aria-label="Font size" value={active.fontSize||12} onChange={e=>format({fontSize:Number(e.target.value)})}><option value={10}>10 pt</option><option value={12}>12 pt</option><option value={14}>14 pt</option><option value={16}>16 pt</option><option value={18}>18 pt</option><option value={24}>24 pt</option><option value={32}>32 pt</option></select></div><small>Font & cell style</small></div><div className="de-group"><div className="de-tools"><select aria-label="Number format" value={active.format||'general'} onChange={e=>format({format:e.target.value as Cell['format']})}><option value="general">General</option><option value="currency">Currency ($)</option><option value="percent">Percent</option></select><button onClick={()=>format({format:'currency'})}>$</button><button onClick={()=>format({format:'percent'})}>%</button></div><small>Number format</small></div><div className="de-group"><div className="de-tools"><button onClick={()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/)!;setActiveCell(keyOf(Math.max(1,Number(m[2])-1),colIndex(m[1])));}}>↑</button><button onClick={()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/)!;setActiveCell(keyOf(Math.min(50,Number(m[2])+1),colIndex(m[1])));}}>↓</button><button onClick={()=>format({fill:'#dcfce7'})}>Highlight</button></div><small>Cell tools</small></div></>}
      {tab==='Insert'&&<><div className="de-group"><div className="de-tools"><button onClick={addSheet}><Plus size={15}/> New sheet</button><button onClick={duplicateSheet}><Plus size={15}/> Duplicate sheet</button><button onClick={()=>updateCell(activeCell,{value:''})}>Clear cell</button><button onClick={()=>importRef.current?.click()}>Import CSV</button></div><small>Tables & sheets</small></div><div className="de-group"><div className="de-tools"><button onClick={()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/)!;const r=Number(m[2]),c=colIndex(m[1]);updateCell(keyOf(r,c),{value:'=SUM('+keyOf(Math.max(1,r-2),c)+':'+keyOf(Math.max(1,r-1),c)+')'});}}><Sigma size={15}/> Quick sum</button><button onClick={exportWorkbook}><Download size={15}/> Backup workbook</button></div><small>Tools</small></div></>}
      {tab==='Formulas'&&<><div className="de-group"><div className="de-tools">{['SUM','AVERAGE','MIN','MAX','COUNT','COUNTA','COUNTBLANK','PRODUCT','MEDIAN','STDEV','VAR','COUNTIF','SUMIF','ROUND','ROUNDUP','ROUNDDOWN','ABS','SQRT','POWER','MOD','INT','LEN','UPPER','LOWER','TRIM','LEFT','RIGHT','CONCAT'].map(fn=><button key={fn} onClick={()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/)!;const r=Number(m[2]),c=m[1];const range=c+Math.max(1,r-3)+':'+c+Math.max(1,r-1);const examples:Record<string,string>={COUNTIF:'COUNTIF('+range+',\"yes\")',SUMIF:'SUMIF('+range+',\"yes\",'+String.fromCharCode(c.charCodeAt(0)+1)+Math.max(1,r-3)+':'+String.fromCharCode(c.charCodeAt(0)+1)+Math.max(1,r-1)+')',ROUND:'ROUND('+c+Math.max(1,r-1)+',2)',ROUNDUP:'ROUNDUP('+c+Math.max(1,r-1)+',0)',ROUNDDOWN:'ROUNDDOWN('+c+Math.max(1,r-1)+',0)',ABS:'ABS('+c+Math.max(1,r-1)+')',SQRT:'SQRT('+c+Math.max(1,r-1)+')',POWER:'POWER('+c+Math.max(1,r-1)+',2)',MOD:'MOD('+c+Math.max(1,r-1)+',2)',INT:'INT('+c+Math.max(1,r-1)+')',LEN:'LEN('+c+Math.max(1,r-1)+')',UPPER:'UPPER('+c+Math.max(1,r-1)+')',LOWER:'LOWER('+c+Math.max(1,r-1)+')',TRIM:'TRIM('+c+Math.max(1,r-1)+')',LEFT:'LEFT('+c+Math.max(1,r-1)+',3)',RIGHT:'RIGHT('+c+Math.max(1,r-1)+',3)',CONCAT:'CONCAT('+c+Math.max(1,r-1)+','+String.fromCharCode(c.charCodeAt(0)+1)+Math.max(1,r-1)+')'};setEditing('='+ (examples[fn]||fn+'('+range+')'));setEditMode(true);}}><Sigma size={14}/>{fn}</button>)}</div><small>Functions</small></div><div className="de-formula-help">Start with =. Ranges: <b>SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTBLANK, PRODUCT, MEDIAN, STDEV, VAR</b>. Criteria: <b>COUNTIF(A1:A8,&quot;yes&quot;)</b>, <b>SUMIF(A1:A8,&quot;yes&quot;,B1:B8)</b>. Numbers: <b>ROUND(A1,2)</b>, ROUNDUP, ROUNDDOWN, ABS, SQRT, POWER, MOD, INT. Text: LEN, UPPER, LOWER, TRIM, LEFT, RIGHT, CONCAT.</div></>}
      {tab==='View'&&<><div className="de-group"><div className="de-tools"><button onClick={()=>setZoom(v=>Math.max(70,v-10))}>−</button><span className="de-zoom">{zoom}%</span><button onClick={()=>setZoom(v=>Math.min(140,v+10))}>+</button><button onClick={()=>setZoom(100)}>Reset zoom</button></div><small>Zoom</small></div><div className="de-group"><div className="de-tools"><button onClick={()=>setShowFind(v=>!v)}><Search size={15}/> Find cells</button><button onClick={exportCsv}><Download size={15}/> Download CSV</button></div><small>Workbook</small></div></>}
    </section>
    {showFind&&<div className="de-find"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&findNext()} placeholder="Find in this sheet"/><button onClick={findNext}>Find next</button><button onClick={()=>setShowFind(false)}>Close</button></div>}
    <div className="de-formula-bar"><span className="de-address">{activeCell}</span><span className="de-fx"><Sigma size={16}/></span><input aria-label="Formula bar" value={editMode?editing:active.value} onFocus={()=>{setEditing(active.value);setEditMode(true)}} onChange={e=>{setEditing(e.target.value);setEditMode(true)}} onKeyDown={e=>{if(e.key==='Enter'){commitEdit();move(1,0)}if(e.key==='Escape'){setEditing(active.value);setEditMode(false)}}} onBlur={()=>{if(editMode)commitEdit()}} placeholder="Enter a value or formula"/>
    </div>
    <div className="de-grid-wrap" ref={gridRef}><table className="de-grid" style={{zoom:zoom/100}}><thead><tr><th className="de-corner"><FileSpreadsheet size={14}/></th>{COLS.map(col=><th key={col}>{col}</th>)}</tr></thead><tbody>{ROWS.map(row=><tr key={row}><th className="de-rowhead">{row}</th>{COLS.map((col,ci)=>{const ref=keyOf(row,ci);const cell=sheet.cells[ref]||{value:''};return <td key={ref} className={activeCell===ref?'de-selected':''} style={{background:cell.fill||undefined,color:cell.color||undefined,fontWeight:cell.bold?700:400,fontStyle:cell.italic?'italic':'normal',textDecoration:cell.underline?'underline':undefined}}><input data-cell={ref} aria-label={'Cell '+ref} value={activeCell===ref&&editMode?editing:display(ref)} style={{fontFamily:cell.fontFamily||'Arial',fontSize:(cell.fontSize||12)+'px'}} onFocus={()=>{if(activeCell!==ref){setActiveCell(ref);setEditing(cell.value);setEditMode(false)}}} onDoubleClick={()=>{setActiveCell(ref);setEditing(cell.value);setEditMode(true)}} onChange={e=>{if(activeCell!==ref)setActiveCell(ref);setEditing(e.target.value);setEditMode(true)}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(editMode)commitEdit();move(1,0)}else if(e.key==='Tab'){e.preventDefault();if(editMode)commitEdit();move(0,e.shiftKey?-1:1)}else if(e.key==='Escape'){setEditing(cell.value);setEditMode(false)}else if(!editMode&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();setActiveCell(ref);setEditing(e.key);setEditMode(true)}}} onBlur={()=>{if(editMode&&activeCell===ref)commitEdit()}} /></td>})}</tr>)}</tbody></table></div>
    <footer className="de-statusbar"><div><Check size={13}/>{status}<span>{nonEmpty} non-empty cells</span></div><div><span>{sheetNames}</span><span>Sheet {book.sheets.findIndex(s=>s.id===selectedSheet)+1} of {book.sheets.length}</span></div></footer>
    <div className="de-sheetbar"><button className="de-addsheet" title="Add worksheet" onClick={addSheet}><Plus size={16}/></button>{book.sheets.map(s=><button key={s.id} className={s.id===selectedSheet?'active':''} onClick={()=>{setSelectedSheet(s.id);setActiveCell('A1');save({...book,activeSheet:s.id})}} onDoubleClick={()=>{const name=window.prompt('Rename worksheet',s.name);if(name?.trim())save({...book,sheets:book.sheets.map(item=>item.id===s.id?{...item,name:name.trim().slice(0,31)}:item)})}} title="Double-click to rename">{s.name}</button>)}<span className="de-sheet-spacer"/><button onClick={()=>importRef.current?.click()}>Import CSV</button><input ref={importRef} type="file" accept=".csv,text/csv,.tsv,text/plain" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importFile(f);e.currentTarget.value=''}}/></div>
  </div>;
}
