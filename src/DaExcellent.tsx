import * as XLSX from 'xlsx';
import { buildChart, chartDataUri } from './chartUtils';
import { useEffect, useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { Bold, Check, Download, FilePlus2, FileSpreadsheet, Italic, Plus, Printer, Search, Sigma, Underline, FolderOpen, Save, Trash2, X } from 'lucide-react';

type Cell = { value: string; bold?: boolean; italic?: boolean; underline?: boolean; color?: string; fill?: string; fontFamily?: string; fontSize?: number; format?: 'general'|'currency'|'percent' };
type SheetData = { id: string; name: string; cells: Record<string, Cell> };
type Workbook = { id: string; title: string; sheets: SheetData[]; activeSheet: string; updatedAt: number; rowCount?:number; colCount?:number; charts?: {id:string;title:string;svg:string;kind:string;labels:string[];values:number[];x?:number;y?:number;width?:number;height?:number}[] };
type IdaFile = { id: string; name: string; kind: 'file'|'note'; location: string; mime?: string; data?: string; createdAt: number };
type Props = { files: IdaFile[]; fileId?: string; onSaveWorkbook: (file: IdaFile) => void; onDeleteWorkbook?: (id:string)=>void };
const MIME = 'application/x-daexcellent';
const columnLabel = (index:number) => { let n=index+1, label=''; while(n>0){const r=(n-1)%26;label=String.fromCharCode(65+r)+label;n=Math.floor((n-1)/26)}return label; };
const COLS = Array.from({ length: 52 }, (_, i) => columnLabel(i));
const ROWS = Array.from({ length: 200 }, (_, i) => i + 1);
const keyOf = (row: number, col: number) => columnLabel(col) + row;
const emptySheet = (): SheetData => ({ id: 'sheet-' + Date.now().toString(36), name: 'Sheet1', cells: {} });
const starter = (): Workbook => {
  const sheet = emptySheet();
  return { id: 'workbook-' + Date.now().toString(36), title: 'Untitled workbook', sheets: [sheet], activeSheet: sheet.id, updatedAt: Date.now(), rowCount:50, colCount:26 };
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
    const m = address.trim().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
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
  const functionMatch = formula.match(/^([A-Z.]+)\((.*)\)$/i);
  if (functionMatch) {
    const fn = functionMatch[1].toUpperCase();
    const args = functionMatch[2].split(',').map(x => x.trim());
    const isRange = (v: string) => /^[A-Z]+\d+:[A-Z]+\d+$/i.test(v);
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
      return String(vals(args[0]).filter(v => { const rawValue=v.raw.toLowerCase(); const op=criterion.match(/^(>=|<=|<>|>|<|=)(.*)$/); if(op){const rhs=op[2].replace(/^"|"$/g,'');const a=Number(rawValue),b=Number(rhs);if(Number.isFinite(a)&&Number.isFinite(b)){switch(op[1]){case '>':return a>b;case '<':return a<b;case '>=':return a>=b;case '<=':return a<=b;case '<>':return a!==b;default:return a===b}}return op[1]==='<'?rawValue<rhs:op[1]==='>'?rawValue>rhs:op[1]==='<>'?rawValue!==rhs:rawValue===rhs;} return rawValue===criterion; }).length);
    }
    if (fn === 'SUMIF' && args.length >= 2 && isRange(args[0])) {
      const criteria=args[1].replace(/^"|"$/g,'').toLowerCase(); const candidates=vals(args[0]); const sums=args[2]&&isRange(args[2])?vals(args[2]):candidates;
      return String(candidates.reduce((sum,v,i)=>sum+(v.raw.toLowerCase()===criteria?numeric(sums[i]?.raw||'0'):0),0));
    }
    const scalar = (arg: string): number => {
      const ref=arg.match(/^([A-Z]+\d+)$/i);
      if(ref)return numeric(evaluate(ref[1].toUpperCase(),sheet,new Set(seen)));
      const n=Number(arg);return Number.isFinite(n)?n:0;
    };
    const textArg=(arg:string):string=>{const clean=arg.trim();const ref=clean.match(/^\$?([A-Z]+)\$?(\d+)$/i);return ref?evaluate(ref[1].toUpperCase()+ref[2],sheet,new Set(seen)):clean.replace(/^"|"$/g,'');};
    const a=scalar(args[0]||'0'), b=scalar(args[1]||'0');
    if(fn==='IF'){const test=args[0]||'FALSE',op=test.match(/^(.*?)\s*(>=|<=|<>|=|>|<)\s*(.*?)$/);let yes=false;if(op){const l=textArg(op[1]),r=textArg(op[3]),ln=Number(l),rn=Number(r);switch(op[2]){case '>':yes=ln>rn;break;case '<':yes=ln<rn;break;case '>=':yes=ln>=rn;break;case '<=':yes=ln<=rn;break;case '<>':yes=l!==r;break;default:yes=l===r||ln===rn;}}else yes=!!scalar(test);return textArg(args[yes?1:2]||'FALSE');}
    if(fn==='IFERROR'){const v=args[0]||'';const ref=v.match(/^([A-Z]+\d+)$/i);const result=ref?evaluate(ref[1].toUpperCase(),sheet,new Set(seen)):v;if(result.startsWith('#'))return textArg(args[1]||'');return result;}
    if(fn==='AND')return String(args.every(v=>['TRUE','1'].includes(textArg(v).toUpperCase())||scalar(v)!==0));
    if(fn==='OR')return String(args.some(v=>['TRUE','1'].includes(textArg(v).toUpperCase())||scalar(v)!==0));
    if(fn==='NOT')return String(!(scalar(args[0]||'0')!==0||textArg(args[0]||'').toUpperCase()==='TRUE'));
    if(fn==='TRUE')return 'TRUE';if(fn==='FALSE')return 'FALSE';if(fn==='PI')return String(Math.PI);
    if(fn==='SIGN')return String(Math.sign(a));if(fn==='TRUNC')return String(Math.trunc(a));if(fn==='QUOTIENT')return b===0?'#DIV/0!':String(Math.trunc(a/b));
    if(fn==='EXP')return String(Math.exp(a));if(fn==='LN')return a<=0?'#NUM!':String(Math.log(a));if(fn==='LOG')return a<=0?'#NUM!':String(Math.log(a)/Math.log(b||10));if(fn==='LOG10')return a<=0?'#NUM!':String(Math.log10(a));
    if(fn==='FACT'){if(a<0||a>170)return '#NUM!';let n=1;for(let i=2;i<=Math.floor(a);i++)n*=i;return String(n);}
    if(fn==='RANDBETWEEN')return String(Math.floor(Math.random()*(Math.floor(b)-Math.ceil(a)+1))+Math.ceil(a));
    if(fn==='PROPER')return textArg(args[0]||'').toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
    if(fn==='MID')return textArg(args[0]||'').slice(Math.max(0,scalar(args[1]||'1')-1),Math.max(0,scalar(args[1]||'1')-1)+Math.max(0,scalar(args[2]||'1')));
    if(fn==='FIND'||fn==='SEARCH'){const needle=textArg(args[0]||''),hay=textArg(args[1]||''),pos=(fn==='FIND'?hay.indexOf(needle):hay.toLowerCase().indexOf(needle.toLowerCase()));return pos<0?'#VALUE!':String(pos+1);}
    if(fn==='SUBSTITUTE'){const source=textArg(args[0]||''),old=textArg(args[1]||''),rep=textArg(args[2]||''),nth=Number(args[3]||0);if(!old)return source;const parts=source.split(old);return parts.slice(0,-1).map((part,i)=>part+(nth&&i+1!==nth?old:rep)).join('')+parts[parts.length-1];}
    if(fn==='REPLACE'){const source=textArg(args[0]||''),start=Math.max(1,scalar(args[1]||'1')),count=Math.max(0,scalar(args[2]||'0'));return source.slice(0,start-1)+textArg(args[3]||'')+source.slice(start-1+count);}
    if(fn==='REPT')return textArg(args[0]||'').repeat(Math.max(0,Math.min(1000,Math.floor(b))));
    if(fn==='EXACT')return String(textArg(args[0]||'')===textArg(args[1]||''));
    if(fn==='VALUE')return Number.isFinite(Number(textArg(args[0]||'')))?String(Number(textArg(args[0]||''))):'#VALUE!';
    if(fn==='TEXTJOIN'){const sep=textArg(args[0]||'');const skip=textArg(args[1]||'TRUE').toUpperCase()!=='FALSE';return args.slice(2).flatMap(arg=>isRange(arg)?vals(arg).map(v=>v.raw):[textArg(arg)]).filter(v=>!skip||v!=='').join(sep);}
    if(fn==='AVERAGEIF'&&args.length>=2&&isRange(args[0])){const criterion=textArg(args[1]).toLowerCase(),candidates=vals(args[0]),sums=args[2]&&isRange(args[2])?vals(args[2]):candidates;const matched=candidates.map((v,i)=>({v,s:sums[i]})).filter(o=>o.v.raw.toLowerCase()===criterion&&o.v.raw!=='').map(o=>o.s?.value||0);return matched.length?String(matched.reduce((x,y)=>x+y,0)/matched.length):'0';}
    if(fn==='MODE'){const ns=args.flatMap(arg=>isRange(arg)?vals(arg).map(v=>v.value):numbers(arg).map(v=>v.value));const counts=new Map<number,number>();ns.forEach(n=>counts.set(n,(counts.get(n)||0)+1));const best=[...counts.entries()].sort((x,y)=>y[1]-x[1])[0];return best&&best[1]>1?String(best[0]):'#N/A';}
    if(fn==='STDEV.S'||fn==='VAR.S'||fn==='STDEV.P'||fn==='VAR.P'){const ns=args.flatMap(arg=>isRange(arg)?vals(arg).map(v=>v.value):numbers(arg).map(v=>v.value));if(!ns.length)return '#DIV/0!';const mean=ns.reduce((x,y)=>x+y,0)/ns.length,variance=ns.reduce((sum,n)=>sum+(n-mean)**2,0)/(fn.endsWith('.S')?Math.max(1,ns.length-1):ns.length);return String(fn.startsWith('STDEV')?Math.sqrt(variance):variance);}
    if(fn==='YEAR'||fn==='MONTH'||fn==='DAY'||fn==='WEEKDAY'){const date=new Date(textArg(args[0]||'')||Number(args[0]));if(Number.isNaN(date.getTime()))return '#VALUE!';return String(fn==='YEAR'?date.getFullYear():fn==='MONTH'?date.getMonth()+1:fn==='DAY'?date.getDate():date.getDay()+1);}
    if(fn==='TODAY'||fn==='NOW'){const date=new Date();return fn==='TODAY'?date.toISOString().slice(0,10):date.toISOString().replace('T',' ').slice(0,19);}
    if(fn==='DATE'){const date=new Date(scalar(args[0]||'2000'),scalar(args[1]||'1')-1,scalar(args[2]||'1'));return date.toISOString().slice(0,10);}
    if(fn==='MATCH'&&args.length>=2&&isRange(args[1])){const target=textArg(args[0]).toLowerCase(),list=vals(args[1]);const i=list.findIndex(v=>v.raw.toLowerCase()===target);return i<0?'#N/A':String(i+1);}
    if(fn==='INDEX'&&args.length>=2&&isRange(args[0])){const m=args[0].match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i)!;const row=scalar(args[1]),col=scalar(args[2]||'1');const c=colIndex(m[1])+col-1,r=Number(m[2])+row-1;return evaluate(keyOf(r,c),sheet,new Set(seen));}
    if((fn==='VLOOKUP'||fn==='HLOOKUP'||fn==='XLOOKUP')&&args.length>=2&&isRange(args[1])){const target=textArg(args[0]).toLowerCase(),m=args[1].match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i)!;const r1=Number(m[2]),r2=Number(m[4]),c1=colIndex(m[1]),c2=colIndex(m[3]);if(fn==='VLOOKUP'){for(let rr=r1;rr<=r2;rr++)if(evaluate(keyOf(rr,c1),sheet,new Set(seen)).toLowerCase()===target)return evaluate(keyOf(rr,Math.min(c2,c1+Math.max(1,scalar(args[2]||'1'))-1)),sheet,new Set(seen));return textArg(args[3]||'#N/A');}if(fn==='HLOOKUP'){for(let cc=c1;cc<=c2;cc++)if(evaluate(keyOf(r1,cc),sheet,new Set(seen)).toLowerCase()===target)return evaluate(keyOf(Math.min(r2,r1+Math.max(1,scalar(args[2]||'1'))-1),cc),sheet,new Set(seen));return textArg(args[3]||'#N/A');}const returnRange=args[2]?.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);if(returnRange){for(let rr=r1;rr<=r2;rr++)if(evaluate(keyOf(rr,c1),sheet,new Set(seen)).toLowerCase()===target)return evaluate(keyOf(Number(returnRange[2])+rr-r1,colIndex(returnRange[1])),sheet,new Set(seen));}return textArg(args[3]||'#N/A');}
    if(fn==='SUMSQ'){const all=args.flatMap(arg=>isRange(arg)?vals(arg):numbers(arg));return String(all.reduce((sum,v)=>sum+v.value*v.value,0));}
    if(fn==='SUMPRODUCT'){const arrays=args.map(arg=>isRange(arg)?vals(arg).map(v=>v.value):[scalar(arg)]);const count=Math.max(0,...arrays.map(v=>v.length));let sum=0;for(let i=0;i<count;i++)sum+=arrays.reduce((prod,arr)=>prod*(arr[i]??0),1);return String(sum);}
    if(fn==='ABS')return String(Math.abs(a)); if(fn==='SQRT')return a<0?'#NUM!':String(Math.sqrt(a));
    if(fn==='POWER')return String(Math.pow(a,b)); if(fn==='MOD')return b===0?'#DIV/0!':String(a%b);
    if(fn==='INT')return String(Math.floor(a)); if(fn==='ROUND')return String(Number(a.toFixed(Math.max(-10,Math.min(10,b)))));
    if(fn==='ROUNDUP')return String(Math.sign(a)*Math.ceil(Math.abs(a)*10**b)/10**b);
    if(fn==='ROUNDDOWN')return String(Math.sign(a)*Math.floor(Math.abs(a)*10**b)/10**b);
    if(fn==='CEILING')return String(Math.ceil(a/(b||1))*(b||1)); if(fn==='FLOOR')return String(Math.floor(a/(b||1))*(b||1));
    if(fn==='LEN')return String((args[0]||'').replace(/^"|"$/g,'').length);
    if(fn==='UPPER')return (args[0]||'').replace(/^"|"$/g,'').toUpperCase();
    if(fn==='LOWER')return (args[0]||'').replace(/^"|"$/g,'').toLowerCase();
    if(fn==='TRIM')return (args[0]||'').replace(/^"|"$/g,'').trim().replace(/\s+/g,' ');
    if(fn==='LEFT'||fn==='RIGHT'){const textValue=(args[0]||'').replace(/^"|"$/g,'');return fn==='LEFT'?textValue.slice(0,b||1):textValue.slice(- (b||1));}
    if(fn==='CONCAT'||fn==='CONCATENATE')return args.map(arg=>{const ref=arg.match(/^([A-Z]+\d+)$/i);return ref?evaluate(ref[1].toUpperCase(),sheet,new Set(seen)):arg.replace(/^"|"$/g,'');}).join('');
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
export default function DaExcellent({ files, fileId, onSaveWorkbook, onDeleteWorkbook }: Props) {
  const initialFile = files.find(f => f.id === fileId && f.mime === MIME);
  const [book, setBook] = useState<Workbook>(() => parseWorkbook(initialFile) || starter());
  const autoCreatedRef=useRef(false); const manualOpenRef=useRef(false); const [showOpen,setShowOpen]=useState(false); const [openSearch,setOpenSearch]=useState(''); const [templateOpen,setTemplateOpen]=useState(false); const [templateChoice,setTemplateChoice]=useState('Budget'); const [saveAsOpen,setSaveAsOpen]=useState(false); const [saveAsTitle,setSaveAsTitle]=useState(''); const [saveAsLocation,setSaveAsLocation]=useState('Documents');
  const [activeCell, setActiveCell] = useState('A1');
  const [editing, setEditing] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState<'Home'|'Insert'|'Formulas'|'View'>('Home');
  const [selectedSheet, setSelectedSheet] = useState(book.activeSheet);
  const [query, setQuery] = useState('');
  const [functionSearch,setFunctionSearch] = useState('');
  const [showFunctions,setShowFunctions] = useState(false);
  const [selectedRange,setSelectedRange] = useState<{startRow:number;startCol:number;endRow:number;endCol:number}|null>(null);
  const dragSelectingRef = useRef(false);
  const selectionAnchorRef = useRef<{row:number;col:number}|null>(null);
  const [showFind, setShowFind] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState('All changes saved');
  const [columnWidths,setColumnWidths]=useState<Record<string,number>>({});
  const [rowHeights,setRowHeights]=useState<Record<number,number>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const visibleRows=book.rowCount||50; const visibleCols=book.colCount||26; const gridRows=ROWS.slice(0,visibleRows); const gridCols=COLS.slice(0,visibleCols);
  const sheet = book.sheets.find(s => s.id === selectedSheet) || book.sheets[0];
  const active = sheet.cells[activeCell] || { value: '' };
  const display = (ref: string) => { const raw = evaluate(ref, sheet); const cell = sheet.cells[ref]; if (cell?.value.trim().startsWith('=') && raw !== '' && !raw.startsWith('#') && Number.isFinite(Number(raw))) { if (cell.format === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(raw)); if (cell.format === 'percent') return (Number(raw) * 100).toLocaleString() + '%'; } return raw; };
  const save = (next: Workbook, location?:string) => {
    const updated = { ...next, updatedAt: Date.now() }; setBook(updated); setStatus('Saving…');
    if(files.some(f=>f.id===updated.id)) onSaveWorkbook({ id: updated.id, name: cleanName(updated.title) + '.daexcel', kind: 'file', location: location||files.find(f=>f.id===updated.id)?.location||'Documents', mime: MIME, data: JSON.stringify(updated), createdAt: updated.updatedAt });
    setStatus('All changes saved');
  };
  useEffect(() => {
    const latest = files.filter(f => f.mime === MIME);
    const desired = fileId ? latest.find(f => f.id === fileId) : undefined;
    const parsed = manualOpenRef.current ? null : parseWorkbook(desired);
    if (parsed && parsed.id !== book.id) { setBook(parsed); setSelectedSheet(parsed.activeSheet || parsed.sheets[0].id); }

  }, [files, fileId]);
  useEffect(() => { const c = book.sheets.find(s => s.id === selectedSheet)?.cells[activeCell]; setEditing(c?.value || ''); setEditMode(false); }, [activeCell, selectedSheet, book.id]);
  const sheetNames = book.sheets.map(s => s.name).join(', ');
  const nonEmpty = Object.values(sheet.cells).filter(c => c.value.trim()).length;
  const updateCell = (ref: string, patch: Partial<Cell>) => {
    const currentSheet = book.sheets.find(s => s.id === selectedSheet) || sheet;
    const nextSheet = { ...currentSheet, cells: { ...currentSheet.cells, [ref]: { ...(currentSheet.cells[ref] || { value: '' }), ...patch } } };
    save({ ...book, activeSheet: selectedSheet, sheets: book.sheets.map(s => s.id === selectedSheet ? nextSheet : s) });
  };
  const commitEdit = () => {
    if (selectedRange && (selectedRange.startRow !== selectedRange.endRow || selectedRange.startCol !== selectedRange.endCol)) {
      const minRow=Math.min(selectedRange.startRow,selectedRange.endRow), maxRow=Math.max(selectedRange.startRow,selectedRange.endRow);
      const minCol=Math.min(selectedRange.startCol,selectedRange.endCol), maxCol=Math.max(selectedRange.startCol,selectedRange.endCol);
      const currentSheet=book.sheets.find(s=>s.id===selectedSheet)||sheet;
      const cells={...currentSheet.cells};
      for(let r=minRow;r<=maxRow;r++)for(let c=minCol;c<=maxCol;c++){const ref=keyOf(r,c);cells[ref]={...(cells[ref]||{value:''}),value:editing};}
      save({...book,activeSheet:selectedSheet,sheets:book.sheets.map(s=>s.id===selectedSheet?{...currentSheet,cells}:s)});
    } else updateCell(activeCell, { value: editing });
    setEditMode(false);
  };
  const clearSelectedRange = () => {
    if(!selectedRange)return;
    const minRow=Math.min(selectedRange.startRow,selectedRange.endRow), maxRow=Math.max(selectedRange.startRow,selectedRange.endRow);
    const minCol=Math.min(selectedRange.startCol,selectedRange.endCol), maxCol=Math.max(selectedRange.startCol,selectedRange.endCol);
    const currentSheet=book.sheets.find(s=>s.id===selectedSheet)||sheet;
    const cells={...currentSheet.cells};
    for(let r=minRow;r<=maxRow;r++)for(let c=minCol;c<=maxCol;c++){const ref=keyOf(r,c);cells[ref]={...(cells[ref]||{value:''}),value:''};}
    save({...book,activeSheet:selectedSheet,sheets:book.sheets.map(s=>s.id===selectedSheet?{...currentSheet,cells}:s)});
    setEditing('');setEditMode(false);
  };
  const insertFunction = (fn:string) => {
    const match=activeCell.match(/^([A-Z]+)(\d+)$/)!;
    const row=Number(match[2]), col=match[1];
    const from=Math.max(1,row-3), to=Math.max(1,row-1);
    const range=col+from+':'+col+to;
    const nextCol=columnLabel(Math.min(visibleCols-1,colIndex(col)+1));
    const examples:Record<string,string>={
      IF:'IF('+col+Math.max(1,row-1)+'<>0,"Yes","No")',IFERROR:'IFERROR('+col+Math.max(1,row-1)+',0)',AND:'AND('+col+from+','+col+to+')',OR:'OR('+col+from+','+col+to+')',NOT:'NOT('+col+Math.max(1,row-1)+')',
      VLOOKUP:'VLOOKUP('+col+Math.max(1,row-1)+',A1:B10,2,FALSE)',HLOOKUP:'HLOOKUP('+col+Math.max(1,row-1)+',A1:J2,2,FALSE)',XLOOKUP:'XLOOKUP('+col+Math.max(1,row-1)+',A1:A10,B1:B10)',INDEX:'INDEX(A1:B10,2,2)',MATCH:'MATCH('+col+Math.max(1,row-1)+',A1:A10,0)',
      TODAY:'TODAY()',NOW:'NOW()',DATE:'DATE(2026,1,1)',YEAR:'YEAR('+col+Math.max(1,row-1)+')',MONTH:'MONTH('+col+Math.max(1,row-1)+')',DAY:'DAY('+col+Math.max(1,row-1)+')',WEEKDAY:'WEEKDAY('+col+Math.max(1,row-1)+')',
      CONCAT:'CONCAT('+col+from+','+col+to+')',CONCATENATE:'CONCATENATE('+col+from+','+col+to+')',TEXTJOIN:'TEXTJOIN(", ",TRUE,'+range+')',MID:'MID('+col+Math.max(1,row-1)+',1,3)',SUBSTITUTE:'SUBSTITUTE('+col+Math.max(1,row-1)+',"old","new")',
      
      COUNTIF:'COUNTIF('+range+',"yes")',
      SUMIF:'SUMIF('+range+',"yes",'+nextCol+from+':'+nextCol+to+')',
      ROUND:'ROUND('+col+Math.max(1,row-1)+',2)',
      ROUNDUP:'ROUNDUP('+col+Math.max(1,row-1)+',0)',
      ROUNDDOWN:'ROUNDDOWN('+col+Math.max(1,row-1)+',0)',
      ABS:'ABS('+col+Math.max(1,row-1)+')', SQRT:'SQRT('+col+Math.max(1,row-1)+')',
      POWER:'POWER('+col+Math.max(1,row-1)+',2)', MOD:'MOD('+col+Math.max(1,row-1)+',2)',
      INT:'INT('+col+Math.max(1,row-1)+')', LEN:'LEN('+col+Math.max(1,row-1)+')',
      UPPER:'UPPER('+col+Math.max(1,row-1)+')', LOWER:'LOWER('+col+Math.max(1,row-1)+')',
      TRIM:'TRIM('+col+Math.max(1,row-1)+')', LEFT:'LEFT('+col+Math.max(1,row-1)+',3)',
      RIGHT:'RIGHT('+col+Math.max(1,row-1)+',3)', CONCAT:'CONCAT('+col+Math.max(1,row-1)+','+nextCol+Math.max(1,row-1)+')'
    };
    setEditing('='+ (examples[fn]||fn+'('+range+')'));
    setEditMode(true);
    gridRef.current?.querySelector<HTMLInputElement>('[data-cell="'+activeCell+'"]')?.focus();
  };
  useEffect(()=>{const stop=()=>{dragSelectingRef.current=false};window.addEventListener('mouseup',stop);return()=>window.removeEventListener('mouseup',stop)},[]);

  const move = (dr: number, dc: number) => {
    const m = activeCell.match(/^([A-Z]+)(\d+)$/); if (!m) return;
    const row = Number(m[2]), col = colIndex(m[1]); const nr = Math.max(1, Math.min(visibleRows, row + dr)), nc = Math.max(0, Math.min(visibleCols-1, col + dc));
    setActiveCell(keyOf(nr,nc)); gridRef.current?.querySelector<HTMLInputElement>('[data-cell="' + keyOf(nr,nc) + '"]')?.focus();
  };
  const addSheet = () => { const n=book.sheets.length+1; const s={...emptySheet(),name:'Sheet'+n}; const next={...book,sheets:[...book.sheets,s],activeSheet:s.id}; save(next); setSelectedSheet(s.id); setActiveCell('A1'); };
  const deleteSheet = (sheetId:string) => { if(book.sheets.length<=1){window.alert('A workbook must have at least one sheet.');return;} const target=book.sheets.find(s=>s.id===sheetId); if(!target)return; if(!window.confirm('Delete sheet "'+target.name+'"? This cannot be undone.'))return; const remaining=book.sheets.filter(s=>s.id!==sheetId); const nextSelected=selectedSheet===sheetId ? remaining[Math.max(0,book.sheets.findIndex(s=>s.id===sheetId)-1)] : (remaining.find(s=>s.id===selectedSheet)||remaining[0]); const next={...book,sheets:remaining,activeSheet:nextSelected.id}; save(next); setSelectedSheet(nextSelected.id); setActiveCell('A1'); setSelectedRange(null); setEditing(''); setEditMode(false); };
  const duplicateSheet = () => { const copy={...sheet,id:'sheet-'+Date.now().toString(36),name:(sheet.name+' copy').slice(0,31),cells:{...sheet.cells}};const next={...book,sheets:[...book.sheets,copy],activeSheet:copy.id};save(next);setSelectedSheet(copy.id);setActiveCell('A1'); };
  const newWorkbook = () => { manualOpenRef.current=true; const next = { ...starter(), title: 'Untitled workbook' }; setBook(next); setSelectedSheet(next.sheets[0].id); setActiveCell('A1'); setStatus('Not saved yet — use Save as to keep this workbook'); };
  const applyTemplate=(name?:string)=>{const choice=name||templateChoice;const next=starter();manualOpenRef.current=true;next.title=choice+' template';const sh=next.sheets[0];const templates:Record<string,Record<string,Cell>>={Budget:{A1:{value:'Item',bold:true,fill:'#dbeafe'},B1:{value:'Quantity',bold:true,fill:'#dbeafe'},C1:{value:'Unit price',bold:true,fill:'#dbeafe'},D1:{value:'Total',bold:true,fill:'#dbeafe'},A2:{value:'Notebook'},B2:{value:'4'},C2:{value:'2.50',format:'currency'},D2:{value:'=B2*C2',format:'currency'},A3:{value:'Pens'},B3:{value:'10'},C3:{value:'0.80',format:'currency'},D3:{value:'=B3*C3',format:'currency'},C5:{value:'Grand total',bold:true},D5:{value:'=SUM(D2:D4)',format:'currency',bold:true}},Gradebook:{A1:{value:'Student',bold:true,fill:'#dbeafe'},B1:{value:'Assignment 1',bold:true,fill:'#dbeafe'},C1:{value:'Assignment 2',bold:true,fill:'#dbeafe'},D1:{value:'Average',bold:true,fill:'#dbeafe'},A2:{value:'Student 1'},B2:{value:'85'},C2:{value:'92'},D2:{value:'=AVERAGE(B2:C2)'}},'Task tracker':{A1:{value:'Task',bold:true,fill:'#dcfce7'},B1:{value:'Owner',bold:true,fill:'#dcfce7'},C1:{value:'Status',bold:true,fill:'#dcfce7'},D1:{value:'Due date',bold:true,fill:'#dcfce7'},A2:{value:'First task'},C2:{value:'Not started'}},Inventory:{A1:{value:'SKU',bold:true,fill:'#fef3c7'},B1:{value:'Product',bold:true,fill:'#fef3c7'},C1:{value:'In stock',bold:true,fill:'#fef3c7'},D1:{value:'Reorder at',bold:true,fill:'#fef3c7'},E1:{value:'Reorder?',bold:true,fill:'#fef3c7'},A2:{value:'SKU-001'},B2:{value:'Product'},C2:{value:'5'},D2:{value:'10'},E2:{value:'Reorder'}}};if(!templates[choice])return;sh.cells=templates[choice];setSelectedSheet(sh.id);setActiveCell('A1');manualOpenRef.current=false;save(next)};
  const saveAsWorkbook=()=>{setSaveAsTitle(book.title+' copy');setSaveAsLocation('Documents');setSaveAsOpen(true)};
  const openWorkbook=(file:IdaFile)=>{const next=parseWorkbook(file);if(!next)return;manualOpenRef.current=true;setBook(next);setSelectedSheet(next.activeSheet||next.sheets[0].id);setActiveCell('A1');setShowOpen(false);setStatus('Opened '+file.name)};

  const format = (patch: Partial<Cell>) => {
    const range=selectedRange;
    if(!range || (range.startRow===range.endRow && range.startCol===range.endCol)){updateCell(activeCell,patch);return;}
    const minRow=Math.min(range.startRow,range.endRow),maxRow=Math.max(range.startRow,range.endRow);
    const minCol=Math.min(range.startCol,range.endCol),maxCol=Math.max(range.startCol,range.endCol);
    const currentSheet=book.sheets.find(s=>s.id===selectedSheet)||sheet;
    const cells={...currentSheet.cells};
    for(let r=minRow;r<=maxRow;r++)for(let c=minCol;c<=maxCol;c++){
      const ref=keyOf(r,c);cells[ref]={...(cells[ref]||{value:''}),...patch};
    }
    save({...book,activeSheet:selectedSheet,sheets:book.sheets.map(s=>s.id===selectedSheet?{...currentSheet,cells}:s)});
  };
  const resizeColumn=(e:ReactMouseEvent,col:string)=>{e.preventDefault();e.stopPropagation();const startX=e.clientX,startWidth=columnWidths[col]||100;const move=(ev:MouseEvent)=>setColumnWidths(prev=>({...prev,[col]:Math.max(48,Math.min(420,startWidth+ev.clientX-startX))}));const up=()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)};window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)};
  const resizeRow=(e:React.MouseEvent,row:number)=>{e.preventDefault();e.stopPropagation();const startY=e.clientY,startHeight=rowHeights[row]||25;const move=(ev:MouseEvent)=>setRowHeights(prev=>({...prev,[row]:Math.max(18,Math.min(180,startHeight+ev.clientY-startY))}));const up=()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)};window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)};
  const beginAutofill=(e:React.MouseEvent)=>{e.preventDefault();e.stopPropagation();const start=activeCell;const up=(ev:MouseEvent)=>{window.removeEventListener('mouseup',up);const target=(document.elementFromPoint(ev.clientX,ev.clientY) as HTMLElement|null)?.closest<HTMLInputElement>('[data-cell]')?.dataset.cell;if(!target||target===start)return;const a=start.match(/^([A-Z]+)(\d+)$/),b=target.match(/^([A-Z]+)(\d+)$/);if(!a||!b)return;const sr=Number(a[2]),sc=colIndex(a[1]),tr=Number(b[2]),tc=colIndex(b[1]);const source=sheet.cells[start]||{value:''};const cells={...sheet.cells};for(let rr=Math.min(sr,tr);rr<=Math.max(sr,tr);rr++)for(let cc=Math.min(sc,tc);cc<=Math.max(sc,tc);cc++){const key=keyOf(rr,cc);if(key!==start)cells[key]={...source};}save({...book,sheets:book.sheets.map(sh=>sh.id===selectedSheet?{...sh,cells}:sh)});};window.addEventListener('mouseup',up)};
  const saveCurrent=()=>{if(editMode){save({...book,sheets:book.sheets.map(sh=>sh.id===selectedSheet?{...sh,cells:{...sh.cells,[activeCell]:{...(sh.cells[activeCell]||{value:''}),value:editing}}}:sh)});setEditMode(false)}else save(book)};
  const addRows=()=>save({...book,rowCount:Math.min(200,visibleRows+10)}); const addColumns=()=>save({...book,colCount:Math.min(52,visibleCols+5)});
  const sortSelectedColumn=(direction:'asc'|'desc')=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/);if(!m)return;const col=m[1],rows=Array.from({length:Math.max(0,visibleRows-1)},(_,i)=>i+2);rows.sort((a,b)=>{const av=sheet.cells[col+a]?.value||'',bv=sheet.cells[col+b]?.value||'',an=Number(av),bn=Number(bv);const cmp=av!==''&&bv!==''&&Number.isFinite(an)&&Number.isFinite(bn)?an-bn:av.localeCompare(bv,undefined,{numeric:true});return direction==='asc'?cmp:-cmp});const cells={...sheet.cells};const oldRows=rows.slice();oldRows.forEach((source,index)=>{const target=index+2;gridCols.forEach(c=>{const from=c+source,to=c+target;if(sheet.cells[from])cells[to]={...sheet.cells[from]};else delete cells[to]})});save({...book,sheets:book.sheets.map(sh=>sh.id===selectedSheet?{...sh,cells}:sh)});};
  const duplicateSelectedRow=()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/);if(!m)return;const row=Number(m[2]),nextRow=Math.min(visibleRows,row+1),cells={...sheet.cells};gridCols.forEach(c=>{const source=sheet.cells[c+row];if(source)cells[c+nextRow]={...source};else delete cells[c+nextRow]});save({...book,sheets:book.sheets.map(sh=>sh.id===selectedSheet?{...sh,cells}:sh)});setActiveCell(m[1]+nextRow)};
  const clearSelectedRow=()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/);if(!m)return;const row=Number(m[2]),cells={...sheet.cells};gridCols.forEach(c=>delete cells[c+row]);save({...book,sheets:book.sheets.map(sh=>sh.id===selectedSheet?{...sh,cells}:sh)})};
  const fillSeriesDown=()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/);if(!m)return;const col=m[1],row=Number(m[2]),raw=sheet.cells[activeCell]?.value||'',n=Number(raw),cells={...sheet.cells};for(let r=row+1;r<=Math.min(visibleRows,row+10);r++)cells[col+r]={...(sheet.cells[activeCell]||{value:''}),value:raw!==''&&Number.isFinite(n)?String(n+r-row):raw};save({...book,sheets:book.sheets.map(sh=>sh.id===selectedSheet?{...sh,cells}:sh)})};
  const highlightNegativeValues=()=>{const cells={...sheet.cells};Object.entries(cells).forEach(([key,cell])=>{if(key.match(/^([A-Z]+)(\d+)$/)&&Number(cell.value)<0)cells[key]={...cell,fill:'#fee2e2',color:'#991b1b'}});save({...book,sheets:book.sheets.map(sh=>sh.id===selectedSheet?{...sh,cells}:sh)})};
  const exportCsv = () => {
    const used = Object.keys(sheet.cells).filter(k => sheet.cells[k]?.value).map(k => { const m=k.match(/^([A-Z]+)(\d+)$/)!; return { c:colIndex(m[1]), r:Number(m[2]) }; });
    const maxR = Math.max(1,...used.map(v=>v.r)), maxC = Math.max(0,...used.map(v=>v.c));
    const lines = Array.from({length:maxR},(_,ri)=>Array.from({length:maxC+1},(_,ci)=>{ const v=display(keyOf(ri+1,ci)); return '"' + v.replace(/"/g,'""') + '"'; }).join(','));
    const blob = new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=cleanName(book.title)+'.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const exportWorkbook = () => { const blob=new Blob([JSON.stringify(book,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=cleanName(book.title)+'.daexcellent.json'; a.click(); URL.revokeObjectURL(url); };
  const exportXlsx = () => { const wb=XLSX.utils.book_new(); book.sheets.forEach(sh=>{const used=Object.keys(sh.cells).map(k=>k.match(/^([A-Z]+)(\d+)$/)).filter(Boolean) as RegExpMatchArray[];const maxR=Math.max(1,...used.map(m=>Number(m[2]))),maxC=Math.max(0,...used.map(m=>colIndex(m[1])));const aoa=Array.from({length:maxR},(_,ri)=>Array.from({length:maxC+1},(_,ci)=>{const ref=keyOf(ri+1,ci),v=sh.cells[ref]?.value||'';return v.startsWith('=')?null:v;}));const ws=XLSX.utils.aoa_to_sheet(aoa);Object.entries(sh.cells).forEach(([ref,cell])=>{if(cell.value.startsWith('=')){ws[ref]={t:'n',f:cell.value.slice(1)};}});XLSX.utils.book_append_sheet(wb,ws,sh.name.slice(0,31));});(book.charts||[]).forEach((chart,i)=>{const ws=XLSX.utils.aoa_to_sheet([[chart.title],['Category','Value'],...chart.labels.map((label,j)=>[label,chart.values[j]])]);XLSX.utils.book_append_sheet(wb,ws,('Graph '+(i+1)).slice(0,31));});XLSX.writeFile(wb,cleanName(book.title)+'.xlsx'); };
  const insertChart = () => {
    if(!selectedRange){window.alert('Select the data range for your graph first (drag across the cells, including labels and values).');return;}
    const r1=Math.min(selectedRange.startRow,selectedRange.endRow),r2=Math.max(selectedRange.startRow,selectedRange.endRow),c1=Math.min(selectedRange.startCol,selectedRange.endCol),c2=Math.max(selectedRange.startCol,selectedRange.endCol);
    if(r2-r1<1){window.alert('Select at least two rows of data for a graph.');return;}
    const labels:string[]=[],values:number[]=[];
    if(c2>c1){for(let r=r1;r<=r2;r++){const label=evaluate(keyOf(r,c1),sheet).trim(),raw=evaluate(keyOf(r,c1+1),sheet).trim();const value=Number(raw.replace(/[$,%]/g,''));if(r===r1&&!Number.isFinite(value))continue;if(label&&Number.isFinite(value)){labels.push(label);values.push(value);}}}
    else {for(let r=r1;r<=r2;r++){const label=evaluate(keyOf(r,c1),sheet).trim();const value=Number(label.replace(/[$,%]/g,''));if(r===r1&&!Number.isFinite(value))continue;if(label&&Number.isFinite(value)){labels.push(String(r));values.push(value);}}}
    if(labels.length<2){window.alert('Could not find enough numeric values in the selected range. Select a label column and a numeric values column.');return;}
    const title=window.prompt('Graph title','Graph of '+columnLabel(c1)+' data');if(title===null)return;
    const kind=(window.prompt('Graph type: bar, line, or pie','bar')||'bar').toLowerCase();
    const chart=buildChart(title,labels,values,(['bar','line','pie'].includes(kind)?kind:'bar') as 'bar'|'line'|'pie');
    const nextChart={...chart,id:'chart-'+Date.now().toString(36),x:Math.max(8,c1*100+48),y:Math.max(8,r1*25+25),width:420,height:250};
    save({...book,charts:[...(book.charts||[]),nextChart]});setStatus('Graph added to sheet — drag it to position it');
  };

  const importFile = (file: File) => {
    const reader=new FileReader(); reader.onload=()=>{ const text=String(reader.result||''); const rows=text.replace(/\r/g,'').split('\n').filter(Boolean).map(line=>{ const out:string[]=[]; let value=''; let quoted=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'&&quoted&&line[i+1]==='"'){value+='"';i++;}else if(ch==='"')quoted=!quoted;else if(ch===','&&!quoted){out.push(value);value='';}else value+=ch;}out.push(value);return out;}); const s={...emptySheet(),name:'Imported data',cells:{} as Record<string,Cell>}; rows.slice(0,50).forEach((row,r)=>row.slice(0,26).forEach((value,c)=>{if(value!=='')s.cells[keyOf(r+1,c)]={value};})); save({...book,title:file.name.replace(/\.[^.]+$/,''),sheets:[s],activeSheet:s.id});setSelectedSheet(s.id);setActiveCell('A1');}; reader.readAsText(file);
  };
  const findNext = () => { if (!query) return; const entries=Object.entries(sheet.cells).sort((a,b)=>{const ma=a[0].match(/^([A-Z]+)(\d+)$/)!,mb=b[0].match(/^([A-Z]+)(\d+)$/)!;return Number(ma[2])-Number(mb[2])||colIndex(ma[1])-colIndex(mb[1]);}); const found=entries.find(([ref,cell])=>ref!==activeCell&&cell.value.toLowerCase().includes(query.toLowerCase())); if(found){setActiveCell(found[0]);gridRef.current?.querySelector<HTMLInputElement>('[data-cell="'+found[0]+'"]')?.focus();} else setStatus('No matches found'); };
  const formulaDraft = editMode ? editing : active.value;
  const functionSuggestions = /^=[A-Z.]*$/i.test(formulaDraft) ? ['SUM','AVERAGE','COUNT','COUNTA','MAX','MIN','IF','IFERROR','AND','OR','NOT','SUMIF','SUMIFS','COUNTIF','COUNTIFS','AVERAGEIF','ROUND','ROUNDUP','ROUNDDOWN','ABS','SQRT','POWER','MOD','PRODUCT','MEDIAN','STDEV','VAR','CONCAT','CONCATENATE','TEXTJOIN','LEFT','RIGHT','MID','LEN','TRIM','UPPER','LOWER','PROPER','SUBSTITUTE','FIND','SEARCH','INDEX','MATCH','VLOOKUP','HLOOKUP','XLOOKUP','TODAY','NOW','DATE','YEAR','MONTH','DAY','NETWORKDAYS','WEEKDAY','RANK','PERCENTILE','QUARTILE','CORREL','SLOPE','INTERCEPT'].filter(fn=>fn.startsWith(formulaDraft.slice(1).split('(')[0].toUpperCase())).slice(0,8) : [];
  const actionButton = (label:string, icon:ReactNode, action:()=>void, activeState=false) => <button type="button" title={label} aria-label={label} className={'de-tool'+(activeState?' selected':'')} onClick={action}>{icon}</button>;
  return <div className="daexcellent">
    <header className="de-titlebar">
      <div className="de-appmark"><FileSpreadsheet size={23}/></div>
      <div className="de-brand"><strong>DaExcellent</strong><span>Spreadsheets, made simple</span></div>
      <div className="de-bookname"><FileSpreadsheet size={16}/><input aria-label="Workbook name" value={book.title} onChange={e=>save({...book,title:e.target.value||'Untitled workbook'})}/><Check size={14}/></div>
      <div className="de-title-actions"><button onClick={newWorkbook}><FilePlus2 size={16}/> New</button><button onClick={()=>setShowOpen(true)}><FolderOpen size={16}/> Open</button><button onClick={()=>setTemplateOpen(true)}><FileSpreadsheet size={16}/> Templates</button><button onClick={saveAsWorkbook}><Save size={16}/> Save as</button><button onClick={exportXlsx}><Download size={16}/> Export XLSX</button><button onClick={exportCsv}><Download size={16}/> Export CSV</button><button onClick={()=>window.print()}><Printer size={16}/> Print</button></div>
    </header>
    {templateOpen&&<div className="office-open-backdrop"><section className="office-action-dialog"><h2>Workbook templates</h2><p>Choose a template to start in DaExcellent.</p><select value={templateChoice} onChange={e=>setTemplateChoice(e.target.value)}><option>Budget</option><option>Gradebook</option><option>Task tracker</option><option>Inventory</option></select><div className="office-action-buttons"><button onClick={()=>setTemplateOpen(false)}>Cancel</button><button className="office-action-primary" onClick={()=>{applyTemplate(templateChoice);setTemplateOpen(false)}}>Use template</button></div></section></div>}
    {saveAsOpen&&<div className="office-open-backdrop"><section className="office-action-dialog"><h2>Save workbook as</h2><p>Choose a file name and IDA folder.</p><label>File name<input value={saveAsTitle} onChange={e=>setSaveAsTitle(e.target.value)} autoFocus/></label><label>Save in<select value={saveAsLocation} onChange={e=>setSaveAsLocation(e.target.value)}><option>Documents</option><option>Desktop</option><option>Pictures</option><option>Music</option><option>Videos</option></select></label><div className="office-action-buttons"><button onClick={()=>setSaveAsOpen(false)}>Cancel</button><button className="office-action-primary" onClick={()=>{if(!saveAsTitle.trim())return;const next={...book,id:'workbook-'+Date.now().toString(36),title:saveAsTitle.trim(),updatedAt:Date.now()};manualOpenRef.current=true;setBook(next);onSaveWorkbook({id:next.id,name:cleanName(next.title)+'.daexcel',kind:'file',location:saveAsLocation,mime:MIME,data:JSON.stringify(next),createdAt:next.updatedAt});setStatus('All changes saved');setSaveAsOpen(false)}}>Save</button></div></section></div>}
    {showOpen&&<div className="office-open-backdrop"><section className="office-open-dialog"><header className="office-open-heading"><div className="office-open-brand"><span className="office-open-appicon sheet"><FileSpreadsheet size={20}/></span><div><strong>Open workbook</strong><small>DaExcellent · IDA Documents</small></div></div><button className="office-open-close" aria-label="Close open dialog" onClick={()=>{setShowOpen(false);setOpenSearch('')}}><X size={18}/></button></header><label className="office-open-search"><Search size={17}/><input value={openSearch} onChange={e=>setOpenSearch(e.target.value)} placeholder="Search workbooks..." autoFocus/><span>{files.filter(f=>f.mime===MIME&&f.name.toLowerCase().includes(openSearch.toLowerCase())).length}</span></label><div className="office-open-list">{files.filter(f=>f.mime===MIME&&f.name.toLowerCase().includes(openSearch.toLowerCase())).map(file=><div className={'office-open-item'+(file.id===book.id?' is-current':'')} key={file.id}><button className="office-open-file" onClick={()=>{openWorkbook(file);setOpenSearch('')}}><span className="office-file-icon sheet"><FileSpreadsheet size={19}/></span><span className="office-file-details"><strong>{file.name}</strong><small>{new Date(file.createdAt).toLocaleString()}</small></span>{file.id===book.id&&<span className="office-open-current">Current</span>}</button><button className="office-open-delete" title="Move to Trash" aria-label={'Delete '+file.name} onClick={()=>{if(window.confirm('Move '+file.name+' to Trash?')){onDeleteWorkbook?.(file.id);if(file.id===book.id){const other=files.find(f=>f.mime===MIME&&f.id!==file.id);if(other)openWorkbook(other);else newWorkbook()}}}}><Trash2 size={16}/></button></div>)}{files.filter(f=>f.mime===MIME&&f.name.toLowerCase().includes(openSearch.toLowerCase())).length===0&&<div className="office-open-empty"><span><FolderOpen size={25}/></span><strong>{openSearch?'No matching workbooks':'No workbooks yet'}</strong><small>{openSearch?'Try a different search term.':'Create a workbook to see it here.'}</small></div>}</div><footer className="office-open-footer"><span>{files.filter(f=>f.mime===MIME).length} workbook{files.filter(f=>f.mime===MIME).length===1?'':'s'} · Saved in Documents</span><button className="office-open-primary" onClick={()=>{newWorkbook();setShowOpen(false);setOpenSearch('')}}><Plus size={16}/> New workbook</button></footer></section></div>}
    <nav className="de-tabs">{(['Home','Insert','View'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}<button className={showFunctions?'active':''} onClick={()=>{setShowFunctions(v=>!v);setFunctionSearch('')}}><Sigma size={14}/> fx Functions</button><span className="de-tabs-spacer"/><button onClick={()=>setShowFind(v=>!v)}><Search size={14}/> Find</button></nav>
    <section className="de-ribbon">
      {tab==='Home'&&<><div className="de-group"><div className="de-tools">{actionButton('Bold',<Bold size={16}/>,()=>format({bold:!active.bold}),!!active.bold)}{actionButton('Italic',<Italic size={16}/>,()=>format({italic:!active.italic}),!!active.italic)}{actionButton('Underline',<Underline size={16}/>,()=>format({underline:!active.underline}),!!active.underline)}<label className="de-color-control" title="Custom text colour">A <input aria-label="Custom font colour" type="color" value={active.color||'#202938'} onChange={e=>format({color:e.target.value})}/></label><label className="de-color-control" title="Custom cell fill">▰ <input aria-label="Custom cell fill" type="color" value={active.fill||'#ffffff'} onChange={e=>format({fill:e.target.value})}/></label><select aria-label="Font family" value={active.fontFamily||'Arial'} onChange={e=>format({fontFamily:e.target.value})}><option>Arial</option><option>Calibri</option><option>Georgia</option><option>Inter</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option></select><select aria-label="Font size" value={active.fontSize||12} onChange={e=>format({fontSize:Number(e.target.value)})}><option value={10}>10 pt</option><option value={12}>12 pt</option><option value={14}>14 pt</option><option value={16}>16 pt</option><option value={18}>18 pt</option><option value={24}>24 pt</option><option value={32}>32 pt</option></select></div><small>Font & cell style</small></div><div className="de-group"><div className="de-tools"><select aria-label="Number format" value={active.format||'general'} onChange={e=>format({format:e.target.value as Cell['format']})}><option value="general">General</option><option value="currency">Currency ($)</option><option value="percent">Percent</option></select><button onClick={()=>format({format:'currency'})}>$</button><button onClick={()=>format({format:'percent'})}>%</button></div><small>Number format</small></div><div className="de-group"><div className="de-tools"><button onClick={()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/)!;setActiveCell(keyOf(Math.max(1,Number(m[2])-1),colIndex(m[1])));}}>↑</button><button onClick={()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/)!;setActiveCell(keyOf(Math.min(50,Number(m[2])+1),colIndex(m[1])));}}>↓</button><button onClick={()=>format({fill:'#dcfce7'})}>Highlight</button></div><small>Cell tools</small></div></>}
      {tab==='Insert'&&<><div className="de-group"><div className="de-tools"><button onClick={addRows} disabled={visibleRows>=200}>+10 rows</button><button onClick={addColumns} disabled={visibleCols>=52}>+5 columns</button><button onClick={addSheet}><Plus size={15}/> New sheet</button><button onClick={insertChart}>＋ Graph</button><button onClick={duplicateSheet}><Plus size={15}/> Duplicate sheet</button><button onClick={()=>updateCell(activeCell,{value:''})}>Clear cell</button><button onClick={()=>importRef.current?.click()}>Import CSV</button></div><small>Tables & sheets</small></div><div className="de-group"><div className="de-tools"><button onClick={()=>{const m=activeCell.match(/^([A-Z]+)(\d+)$/)!;const r=Number(m[2]),c=colIndex(m[1]);updateCell(keyOf(r,c),{value:'=SUM('+keyOf(Math.max(1,r-2),c)+':'+keyOf(Math.max(1,r-1),c)+')'});}}><Sigma size={15}/> Quick sum</button><button onClick={()=>sortSelectedColumn("asc")}>Sort A→Z</button><button onClick={()=>sortSelectedColumn("desc")}>Sort Z→A</button><button onClick={duplicateSelectedRow}>Duplicate row</button><button onClick={clearSelectedRow}>Clear row</button><button onClick={fillSeriesDown}>Fill series down</button><button onClick={highlightNegativeValues}>Highlight negatives</button><button onClick={exportWorkbook}><Download size={15}/> Backup workbook</button></div><small>Tools</small></div></>}
      {showFunctions&&<div className="de-functions-layout de-functions-popup"><div className="de-functions-popup-head"><strong>Insert Function</strong><button aria-label="Close functions" onClick={()=>setShowFunctions(false)}><X size={15}/></button></div>
      <div className="de-functions-search"><Search size={16}/><input aria-label="Search functions" value={functionSearch} onChange={e=>setFunctionSearch(e.target.value)} placeholder="Search functions (e.g. SUM, text, rounding)…"/>{functionSearch&&<button onClick={()=>setFunctionSearch('')} aria-label="Clear function search"><X size={14}/></button>}</div>
      <div className="de-function-columns">{([
        {name:'Math, totals & rounding',items:['SUM','SUMPRODUCT','SUMSQ','SUBTOTAL','AGGREGATE','AVERAGE','AVERAGEIF','AVERAGEIFS','MIN','MAX','MINIFS','MAXIFS','PRODUCT','MEDIAN','MODE','STDEV','STDEV.S','STDEV.P','VAR','VAR.S','VAR.P','ROUND','ROUNDUP','ROUNDDOWN','MROUND','CEILING','FLOOR','ABS','SIGN','SQRT','POWER','MOD','QUOTIENT','INT','TRUNC','RAND','RANDBETWEEN','PI','EXP','LN','LOG','LOG10','FACT','COMBIN','GCD','LCM','EVEN','ODD']},
        {name:'Counting & criteria',items:['COUNT','COUNTA','COUNTBLANK','COUNTIF','COUNTIFS','SUMIF','SUMIFS','AVERAGEIF','AVERAGEIFS','IF','IFS','IFERROR','AND','OR','NOT','TRUE','FALSE']},
        {name:'Text',items:['LEN','UPPER','LOWER','PROPER','TRIM','CLEAN','LEFT','RIGHT','MID','FIND','SEARCH','SUBSTITUTE','REPLACE','CONCAT','CONCATENATE','TEXTJOIN','EXACT','REPT','VALUE','TEXT','CHAR','CODE']},
        {name:'Lookup & reference',items:['INDEX','MATCH','VLOOKUP','HLOOKUP','XLOOKUP','CHOOSE','ROW','ROWS','COLUMN','COLUMNS','ADDRESS','INDIRECT','OFFSET','TRANSPOSE','UNIQUE','SORT','FILTER']},
        {name:'Date & time',items:['TODAY','NOW','DATE','YEAR','MONTH','DAY','WEEKDAY','WEEKNUM','EDATE','EOMONTH','DAYS','DATEDIF','NETWORKDAYS','WORKDAY','HOUR','MINUTE','SECOND','TIME','DATEVALUE','YEARFRAC']},
        {name:'Statistics & analysis',items:['RANK','RANK.EQ','PERCENTILE','PERCENTILE.INC','QUARTILE','QUARTILE.INC','LARGE','SMALL','CORREL','SLOPE','INTERCEPT','FORECAST','FREQUENCY','GEOMEAN','HARMEAN','DEVSQ','COUNTUNIQUE']},
      ] as {name:string;items:string[]}[]).map(group=>{const term=functionSearch.trim().toLowerCase();const items=group.items.filter(fn=>fn.toLowerCase().includes(term)||(term.length>0&&group.name.toLowerCase().includes(term)));return items.length?<div className="de-function-column" key={group.name}><h4>{group.name}</h4><div className="de-function-list">{items.map(fn=><button key={fn} title={'Insert '+fn+' formula into '+activeCell} onClick={()=>insertFunction(fn)}><Sigma size={14}/><span>{fn}</span><small>{['SUM','AVERAGE','MIN','MAX','PRODUCT','MEDIAN','STDEV','VAR'].includes(fn)?'Numbers': ['COUNT','COUNTA','COUNTBLANK','COUNTIF','SUMIF'].includes(fn)?'Count':'Text / value'}</small></button>)}</div></div>:null})}</div>
      <div className="de-formula-help">Choose a function to insert a starter formula into <b>{activeCell}</b>. You can edit the cell references and ranges in the formula bar.</div>
    </div>}
      {tab==='View'&&<><div className="de-group"><div className="de-tools"><button onClick={()=>setZoom(v=>Math.max(70,v-10))}>−</button><span className="de-zoom">{zoom}%</span><button onClick={()=>setZoom(v=>Math.min(140,v+10))}>+</button><button onClick={()=>setZoom(100)}>Reset zoom</button></div><small>Zoom</small></div><div className="de-group"><div className="de-tools"><button onClick={()=>setShowFind(v=>!v)}><Search size={15}/> Find cells</button><button onClick={exportCsv}><Download size={15}/> Download CSV</button></div><small>Workbook</small></div></>}
    </section>
    {showFind&&<div className="de-find"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&findNext()} placeholder="Find in this sheet"/><button onClick={findNext}>Find next</button><button onClick={()=>setShowFind(false)}>Close</button></div>}
    <div className="de-formula-bar"><span className="de-address">{activeCell}</span><button className="de-fx" title="Insert function" onMouseDown={e=>e.preventDefault()} onClick={()=>{setShowFunctions(v=>!v);setTab('Home')}}><Sigma size={16}/></button><input aria-label="Formula bar" value={editMode?editing:active.value} onFocus={()=>{setEditing(active.value);setEditMode(true)}} onChange={e=>{setEditing(e.target.value);setEditMode(true)}} onKeyDown={e=>{if(e.key==='Enter'){commitEdit();move(1,0)}if(e.key==='Escape'){setEditing(active.value);setEditMode(false)}}} onBlur={()=>{if(editMode)commitEdit()}} placeholder="Enter a value or formula"/>{functionSuggestions.length>0&&<div className="de-function-suggestions">{functionSuggestions.map(fn=><button key={fn} onMouseDown={e=>e.preventDefault()} onClick={()=>{const value='='+fn+'(';setEditing(value);setEditMode(true);updateCell(activeCell,{value});gridRef.current?.querySelector<HTMLInputElement>('[aria-label="Formula bar"]')?.focus()}}><b>{fn}</b><span>Insert function</span></button>)}</div>}
    </div>
    <div className="de-grid-wrap" ref={gridRef}><table className="de-grid" style={{zoom:zoom/100}}><thead><tr><th className="de-corner"><FileSpreadsheet size={14}/></th>{gridCols.map(col=><th key={col} style={{width:columnWidths[col]||100,minWidth:columnWidths[col]||100}}>{col}<span className="de-col-resize" title="Drag to resize column" onMouseDown={e=>resizeColumn(e,col)}/></th>)}</tr></thead><tbody>{gridRows.map(row=><tr key={row} style={{height:rowHeights[row]||25}}><th className="de-rowhead" style={{height:rowHeights[row]||25}}>{row}<span className="de-row-resize" title="Drag to resize row" onMouseDown={e=>resizeRow(e,row)}/></th>{gridCols.map((col,ci)=>{const ref=keyOf(row,ci);const cell=sheet.cells[ref]||{value:''};return <td key={ref} className={(activeCell===ref?'de-selected ':'')+(selectedRange&&row>=Math.min(selectedRange.startRow,selectedRange.endRow)&&row<=Math.max(selectedRange.startRow,selectedRange.endRow)&&ci>=Math.min(selectedRange.startCol,selectedRange.endCol)&&ci<=Math.max(selectedRange.startCol,selectedRange.endCol)?'de-range-selected':'')} style={{width:columnWidths[col]||100,minWidth:columnWidths[col]||100,height:rowHeights[row]||25,background:cell.fill||undefined,color:cell.color||undefined,fontWeight:cell.bold?700:400,fontStyle:cell.italic?'italic':'normal',textDecoration:cell.underline?'underline':undefined}} onMouseDown={e=>{if(e.button!==0)return;const anchor={row,col:ci};selectionAnchorRef.current=anchor;dragSelectingRef.current=true;setSelectedRange(null);setActiveCell(ref);}} onMouseEnter={()=>{if(dragSelectingRef.current&&selectionAnchorRef.current){const anchor=selectionAnchorRef.current;if(anchor.row!==row||anchor.col!==ci)setSelectedRange({startRow:anchor.row,startCol:anchor.col,endRow:row,endCol:ci});}}}><input data-cell={ref} aria-label={'Cell '+ref} value={activeCell===ref&&editMode?editing:display(ref)} style={{fontFamily:cell.fontFamily||'Arial',fontSize:(cell.fontSize||12)+'px'}} onFocus={()=>{if(activeCell!==ref){setActiveCell(ref);setEditing(cell.value);setEditMode(false)}}} onDoubleClick={()=>{setActiveCell(ref);setEditing(cell.value);setEditMode(true)}} onChange={e=>{if(activeCell!==ref)setActiveCell(ref);setEditing(e.target.value);setEditMode(true);updateCell(ref,{value:e.target.value})}} onKeyDown={e=>{if(selectedRange&&(selectedRange.startRow!==selectedRange.endRow||selectedRange.startCol!==selectedRange.endCol)&&(e.key==='Backspace'||e.key==='Delete')){e.preventDefault();clearSelectedRange();return}if(e.key==='Enter'){e.preventDefault();if(editMode)commitEdit();move(1,0)}else if(e.key==='Tab'){e.preventDefault();if(editMode)commitEdit();move(0,e.shiftKey?-1:1)}else if(e.key==='Escape'){setEditing(cell.value);setEditMode(false)}else if(!editMode&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();setActiveCell(ref);setEditing(e.key);setEditMode(true)}}} onBlur={()=>{if(editMode&&activeCell===ref)commitEdit()}} />{activeCell===ref&&editMode&&functionSuggestions.length>0&&<div className="de-cell-function-suggestions">{functionSuggestions.map(fn=><button key={fn} onMouseDown={e=>e.preventDefault()} onClick={()=>{const value='='+fn+'(';setEditing(value);setEditMode(true);updateCell(ref,{value});gridRef.current?.querySelector<HTMLInputElement>('[data-cell="'+ref+'"]')?.focus()}}><b>{fn}</b><span>Function</span></button>)}</div>}{activeCell===ref&&<span className="de-fill-handle" title="Drag to fill cells" onMouseDown={beginAutofill}/>}</td>})}</tr>)}</tbody></table>
    {(book.charts||[]).map(chart=><section key={chart.id} className="de-floating-chart" style={{left:(chart.x??160),top:(chart.y??70),width:(chart.width??420),height:(chart.height??250)}} onMouseDown={e=>{if((e.target as HTMLElement).closest('button'))return;e.preventDefault();const startX=e.clientX,startY=e.clientY,startLeft=chart.x??160,startTop=chart.y??70;const move=(ev:MouseEvent)=>save({...book,charts:(book.charts||[]).map(c=>c.id===chart.id?{...c,x:Math.max(0,startLeft+ev.clientX-startX),y:Math.max(0,startTop+ev.clientY-startY)}:c)});const up=()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)};window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)}}><div className="de-floating-chart-head"><strong>{chart.title}</strong><span>Drag to move</span><button title="Delete graph" onClick={()=>save({...book,charts:(book.charts||[]).filter(c=>c.id!==chart.id)})}><X size={14}/></button></div><img draggable={false} alt={chart.title} src={chartDataUri(chart.svg)}/></section>)}
    </div>
    <footer className="de-statusbar"><div><Check size={13}/>{status}<span>{nonEmpty} non-empty cells</span></div><div><span>{sheetNames}</span><span>Sheet {book.sheets.findIndex(s=>s.id===selectedSheet)+1} of {book.sheets.length}</span></div></footer>
    <div className="de-sheetbar"><button className="de-addsheet" title="Add worksheet" aria-label="Add worksheet" onClick={addSheet}><Plus size={12}/></button>{book.sheets.map(s=><span className={'de-sheet-tab'+(s.id===selectedSheet?' active':'')} key={s.id}><button className="de-sheet-tab-name" onClick={()=>{setSelectedSheet(s.id);setActiveCell('A1');save({...book,activeSheet:s.id})}} onDoubleClick={()=>{const name=window.prompt('Rename worksheet',s.name);if(name?.trim())save({...book,sheets:book.sheets.map(item=>item.id===s.id?{...item,name:name.trim().slice(0,31)}:item)})}} title="Double-click to rename">{s.name}</button><button className="de-sheet-delete" aria-label={'Delete '+s.name} title={'Delete '+s.name} onClick={()=>deleteSheet(s.id)}><Trash2 size={12}/></button></span>)}<span className="de-sheet-spacer"/><button onClick={()=>importRef.current?.click()}>Import CSV</button><input ref={importRef} type="file" accept=".csv,text/csv,.tsv,text/plain" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importFile(f);e.currentTarget.value=''}}/></div>
  </div>;
}
