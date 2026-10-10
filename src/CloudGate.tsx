import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import { DaApps } from './App'
import { Wifi, Music2, Scale } from 'lucide-react'

const SUPABASE_URL = 'https://hcvpnvzznmoxhklguxhh.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_L0sVGo7ZgCe-A_6EOTzYrQ_52xnGIhh'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

const ACCOUNT_SESSION_KEY = 'ida-account-session-v1'
const GUEST_LOCK_KEY = 'ida-guest-lock-v1'
// Track unsynced local edits without including the marker in the cloud snapshot.
const CLOUD_DIRTY_KEY = 'ida-cloud-dirty-account-v1'
const SYNC_PREFIXES = ['ida-', 'daapps-']
const isSyncKey = (key: string) => key !== ACCOUNT_SESSION_KEY && key !== GUEST_LOCK_KEY && key !== CLOUD_DIRTY_KEY && key !== 'ida-firstboot-complete-v3' && SYNC_PREFIXES.some(prefix => key.startsWith(prefix))
type IdaSession = { accountId:string; sessionToken:string; displayName:string }
function readIdaSession(): IdaSession|null {
  try {
    const raw=localStorage.getItem(ACCOUNT_SESSION_KEY)
    if(!raw)return null
    const parsed=JSON.parse(raw)
    if(parsed?.accountId&&parsed?.sessionToken&&parsed?.displayName)return parsed as IdaSession
  } catch {}
  return null
}
function writeIdaSession(session:IdaSession|null) {
  try {
    if(session)localStorage.setItem(ACCOUNT_SESSION_KEY,JSON.stringify(session))
    else localStorage.removeItem(ACCOUNT_SESSION_KEY)
  } catch {}
}
type CloudState = { version: 1; keys: Record<string, string> }

function readLocalState(): CloudState {
  const keys: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !isSyncKey(key)) continue
    const value = localStorage.getItem(key)
    if (value !== null) keys[key] = value
  }
  return { version: 1, keys }
}
function clearLocalState() {
  const existing: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && isSyncKey(key)) existing.push(key)
  }
  existing.forEach(key => localStorage.removeItem(key))
}

function applyLocalState(state: CloudState) {
  clearLocalState()
  Object.entries(state.keys || {}).forEach(([key, value]) => localStorage.setItem(key, value))
}
function looksLikeIdaState(state: unknown): state is CloudState {
  return !!state && typeof state === 'object' && (state as any).version === 1 && !!(state as any).keys
}

const inputStyle: CSSProperties = { width:'100%',boxSizing:'border-box',padding:'14px 15px',borderRadius:10,border:'1px solid rgba(255,255,255,.16)',background:'rgba(255,255,255,.055)',color:'#fff',outline:'none',fontSize:15 }
const buttonStyle: CSSProperties = { width:'100%',marginTop:16,padding:'13px 14px',border:0,borderRadius:10,background:'#fff',color:'#111',fontWeight:700,cursor:'pointer',fontSize:14 }
const switchStyle: CSSProperties = { width:'100%',marginTop:12,padding:9,border:0,background:'transparent',color:'#fff',opacity:.68,cursor:'pointer',fontSize:13 }

const FIRSTBOOT_WALLPAPER = 'https://images.pexels.com/photos/7025657/pexels-photo-7025657.jpeg?cs=srgb&dl=pexels-nasimgs-7025657.jpg&fm=jpg'

class IdaDesktopBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <div style={{position:'fixed',inset:0,zIndex:999999,display:'grid',placeItems:'center',background:'#05070b',color:'#fff',fontFamily:'Segoe UI,system-ui,sans-serif',textAlign:'center',padding:24}}>
      <div>
        <div style={{fontSize:24,fontWeight:600}}>IDA recovered from an app error</div>
        <div style={{marginTop:8,opacity:.7,fontSize:13}}>Your account and files are safe. Reset the saved open-window layout to continue.</div>
        <button onClick={() => { try { localStorage.removeItem('ida-open-windows-v1'); localStorage.removeItem('ida-active-window-v1'); sessionStorage.setItem('ida-reset-window-layout-once','1') } catch {} location.reload() }} style={{marginTop:18,padding:'11px 18px',border:0,borderRadius:10,cursor:'pointer',fontWeight:700}}>Continue to IDA</button>
      </div>
    </div>
  }
}

function Hilal({ small=false }: { small?: boolean }) {
  const s=small?42:58
  return <div style={{position:'relative',width:s,height:s,margin:'0 auto'}}>
    <div style={{position:'absolute',inset:2,borderRadius:'50%',background:'#fff',boxShadow:'0 0 32px rgba(255,255,255,.16)'}}/>
    <div style={{position:'absolute',width:s-8,height:s-8,left:s*.28,top:-1,borderRadius:'50%',background:'#080b12'}}/>
  </div>
}

const bootStyle: CSSProperties = { position:'fixed',inset:0,zIndex:999999,background:'#000',color:'#fff',display:'grid',placeItems:'center',fontFamily:'Segoe UI,system-ui,sans-serif' }

function BootScreen({ stage }: { stage:'loading'|'hi'|'working'|'install' }) {
  const text = stage==='loading' ? 'This won’t take long' : stage==='hi' ? 'Hi.' : stage==='working' ? 'We are working on IDA' : 'Getting things ready'
  return <div style={bootStyle}>
    <style>{`
      @keyframes idaBootFade{0%{opacity:0;transform:translateY(7px)}38%{opacity:1;transform:none}62%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-7px)}}
      .ida-hi-text{animation:idaBootFade 5s ease both}
      @keyframes idaSpinner{to{transform:rotate(360deg)}}
      .ida-boot-text{animation:idaBootFade 3s ease both}
    `}</style>
    <div className={stage==='hi' ? 'ida-hi-text' : undefined} style={{textAlign:'center',animation:stage==='hi'||stage==='working'?undefined:'idaBootFade 3s ease both'}}>
      {stage==='hi' ? <div style={{fontSize:'clamp(42px,6vw,68px)',fontWeight:300,letterSpacing:'-.05em'}}>Hi.</div> :
       stage==='working' ? <><div style={{fontSize:'clamp(26px,4vw,40px)',fontWeight:350,letterSpacing:'-.02em'}}>We are working on IDA</div><div style={{margin:'28px auto 0',width:20,height:20,border:'2px solid rgba(255,255,255,.22)',borderTopColor:'#fff',borderRadius:'50%',animation:'idaSpinner 1s linear infinite'}}/></> :
       stage==='install' ? <><div style={{fontSize:24,fontWeight:350}}>{text}</div><div style={{margin:'26px auto 0',width:18,height:18,border:'2px solid rgba(255,255,255,.22)',borderTopColor:'#fff',borderRadius:'50%',animation:'idaSpinner 1s linear infinite'}}/></> :
       <div className="ida-boot-text" style={{fontSize:24,fontWeight:350}}>{text}</div>}
    </div>
  </div>
}

function LanguageChoiceScreen({ selected, onSelect, onContinue }: { selected:'en'|'cs'|'vi'|'ar-YE'; onSelect:(v:'en'|'cs'|'vi'|'ar-YE')=>void; onContinue:()=>void }) {
  const choices:[LanguageChoice, string, string][] = [['en','English','English interface'],['cs','Czech','Čeština'],['vi','Vietnamese','Tiếng Việt'],['ar-YE','Yemeni Arabic','العربية اليمنية']]
  return <div style={{...bootStyle,background:'radial-gradient(circle at 50% 35%,rgba(55,65,88,.3),transparent 45%),#080b12',padding:16,boxSizing:'border-box'}}>
    <style>{'@keyframes idaLanguageIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.ida-language-choice{animation:idaLanguageIn .55s cubic-bezier(.2,.8,.2,1) both;transition:transform .2s,border-color .2s,background .2s}.ida-language-choice:hover{transform:translateY(-2px)}@media(prefers-reduced-motion:reduce){.ida-language-choice{animation:none;transition:none}}'}</style>
    <div style={{width:'min(560px,calc(100vw - 32px))',maxHeight:'94vh',overflowY:'auto',padding:'clamp(22px,4vw,34px)',boxSizing:'border-box',borderRadius:22,background:'rgba(18,22,32,.92)',border:'1px solid rgba(255,255,255,.1)',boxShadow:'0 28px 90px rgba(0,0,0,.5)',backdropFilter:'blur(20px)',animation:'idaLanguageIn .65s ease both'}}>
      <Hilal small/>
      <div style={{textAlign:'center',marginTop:20}}>
        <div style={{fontSize:27,fontWeight:600,letterSpacing:'-.03em'}}>Choose your language</div>
        <div style={{marginTop:7,fontSize:13,lineHeight:1.6,opacity:.62}}>Pick the flag and language you’re most comfortable with. You can change this later in IDA Settings.</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginTop:24}}>
        {choices.map(([id,label,native],i)=><button className="ida-language-choice" key={id} onClick={()=>onSelect(id)} style={{animationDelay:(i*70)+'ms',minWidth:0,display:'flex',alignItems:'center',gap:12,padding:'15px 13px',borderRadius:14,border:selected===id?'1px solid rgba(210,225,255,.8)':'1px solid rgba(255,255,255,.1)',background:selected===id?'linear-gradient(135deg,rgba(135,164,218,.2),rgba(255,255,255,.06))':'rgba(255,255,255,.035)',color:'#fff',cursor:'pointer',textAlign:'left',boxShadow:selected===id?'0 0 0 2px rgba(180,205,255,.08)':'none'}}>
          <SetupFlag code={id}/>
          <span style={{display:'grid',gap:4,flex:1,minWidth:0}}><span style={{fontSize:14,fontWeight:650}}>{label}</span><span dir={id==='ar-YE'?'rtl':undefined} style={{fontSize:11,opacity:.58,overflowWrap:'anywhere'}}>{native}</span></span>
          <span style={{flexShrink:0,width:20,height:20,borderRadius:'50%',border:selected===id?'0':'1px solid rgba(255,255,255,.3)',background:selected===id?'#dfe9ff':'transparent',display:'grid',placeItems:'center',color:'#111',fontSize:12,fontWeight:800}}>{selected===id?'✓':''}</span>
        </button>)}
      </div>
      <button onClick={onContinue} style={{...buttonStyle,marginTop:22}}>Continue <span style={{marginLeft:7}}>→</span></button>
    </div>
  </div>
}

type LanguageChoice = 'en'|'cs'|'vi'|'ar-YE'

function FullscreenGuide({step,onNext,onBack,onContinue}:{step:number;onNext:()=>void;onBack:()=>void;onContinue:()=>void}) {
  const [ready,setReady]=useState(false)
  useEffect(()=>{setReady(false);const t=window.setTimeout(()=>setReady(true),60);return()=>window.clearTimeout(t)},[step])
  const keyboard=step===0
  const card:CSSProperties={width:'min(650px,100%)',maxHeight:'94vh',overflowY:'auto',padding:'clamp(22px,4vw,38px)',boxSizing:'border-box',borderRadius:24,background:'rgba(18,22,32,.94)',border:'1px solid rgba(255,255,255,.1)',boxShadow:'0 28px 90px rgba(0,0,0,.5)',backdropFilter:'blur(22px)',animation:'idaGuideRise .65s cubic-bezier(.2,.8,.2,1) both',opacity:ready?1:0}
  return <div style={{...bootStyle,background:'radial-gradient(ellipse at 50% 12%,rgba(82,102,145,.24),transparent 48%),#080b12',padding:18,boxSizing:'border-box'}}><style>{'@keyframes idaGuideRise{from{opacity:0;transform:translateY(18px) scale(.98);filter:blur(5px)}to{opacity:1;transform:none;filter:blur(0)}}@keyframes idaGuideFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes idaGuidePulse{0%,100%{box-shadow:0 0 0 0 rgba(150,190,255,0)}50%{box-shadow:0 0 0 9px rgba(150,190,255,.08)}}.ida-guide-art{animation:idaGuideFloat 4s ease-in-out infinite}.ida-guide-key{animation:idaGuidePulse 2.4s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.ida-guide-art,.ida-guide-key{animation:none!important}}'}</style>
    <div style={card}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',opacity:.55}}>IDA · QUICK TIP {step+1} OF 2</span><span style={{display:'flex',gap:5}}>{[0,1].map(n=><span key={n} style={{width:n===step?23:6,height:6,borderRadius:9,background:n===step?'#dfe9ff':'#ffffff30',transition:'all .3s'}}/>)}</span></div>
      <div style={{textAlign:'center',marginTop:22}}><Hilal small/><h1 style={{fontSize:'clamp(24px,4vw,32px)',fontWeight:600,letterSpacing:'-.035em',margin:'17px 0 8px'}}>{keyboard?'Make IDA fill your screen':'No F11? Use the browser menu'}</h1><p style={{fontSize:14,lineHeight:1.7,color:'#aeb8ca',margin:'0 auto',maxWidth:480}}>{keyboard?'For the most immersive desktop, hide the browser bars with one key.':'You can enter full screen with your mouse too. In Chrome, open the three-dot menu and choose the Full screen icon beside Zoom.'}</p></div>
      <div className='ida-guide-art' style={{margin:'28px auto 24px',width:'min(420px,100%)',minHeight:155,display:'grid',placeItems:'center'}}>{keyboard?<div style={{width:'100%',padding:17,borderRadius:18,background:'linear-gradient(145deg,#202938,#10151e)',border:'1px solid #ffffff20',boxShadow:'0 18px 35px #0005'}}><div style={{display:'flex',gap:6,marginBottom:14,opacity:.4}}>{[0,1,2].map(n=><span key={n} style={{width:7,height:7,borderRadius:8,background:'#fff'}}/>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:7}}>{['Esc','F1','F2','F3','F4','F5','F6'].map(k=><div key={k} style={{height:32,display:'grid',placeItems:'center',borderRadius:6,background:'#303949',border:'1px solid #ffffff15',fontSize:10,color:'#bfc9da'}}>{k}</div>)}<div className='ida-guide-key' style={{gridColumn:'span 2',height:43,display:'grid',placeItems:'center',borderRadius:9,background:'linear-gradient(145deg,#e5edff,#a9c5ff)',color:'#101727',fontWeight:800,fontSize:16,border:'1px solid #fff'}}>F11</div>{['F8','F9','F10','Del','Home'].map(k=><div key={k} style={{height:32,display:'grid',placeItems:'center',borderRadius:6,background:'#303949',border:'1px solid #ffffff15',fontSize:10,color:'#bfc9da'}}>{k}</div>)}</div><div style={{textAlign:'center',fontSize:11,color:'#b8c4d8',marginTop:12}}>Press F11 · On some laptops, try Fn + F11</div></div>:<div style={{width:'100%',padding:17,borderRadius:18,background:'linear-gradient(145deg,#202938,#10151e)',border:'1px solid #ffffff20',boxShadow:'0 18px 35px #0005'}}><div style={{height:25,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 8px',borderRadius:7,background:'#080c13',fontSize:10,color:'#aeb8ca'}}><span>ida-os.github.io</span><span style={{fontSize:18,letterSpacing:3}}>⋮</span></div><div style={{margin:'12px 0 0 auto',width:'72%',padding:11,borderRadius:10,background:'#f3f5fa',color:'#202938',boxShadow:'0 10px 25px #0005'}}><div style={{fontSize:11,fontWeight:700,marginBottom:9}}>Browser menu</div><div style={{fontSize:10,padding:'7px 6px',borderRadius:5,background:'#dce5f7',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>Zoom</span><span>−　100%　＋</span></div><div style={{fontSize:10,padding:'9px 6px',display:'flex',justifyContent:'space-between',alignItems:'center',fontWeight:700}}><span>⛶　Full screen</span><span>↗</span></div></div></div>}</div>
      <div style={{display:'flex',gap:10,alignItems:'flex-start',padding:13,borderRadius:12,background:'#ffffff08',border:'1px solid #ffffff0e',fontSize:12,lineHeight:1.6,color:'#c4cede'}}><span style={{fontSize:17}}>{keyboard?'⌨':'🖱'}</span><span>{keyboard?'If F11 does nothing, try Fn + F11. You can also use the browser’s three-dot menu → Full screen.':'To return to normal mode, press F11 again, or use the same browser menu. Full screen only hides browser controls; it does not change IDA settings.'}</span></div>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:22}}><button onClick={onBack} style={{...buttonStyle,width:'auto',padding:'0 18px',background:'transparent',border:'1px solid #ffffff25',color:'#fff',visibility:step===0?'hidden':'visible'}}>Back</button>{keyboard?<button onClick={onNext} style={{...buttonStyle,flex:1}}>Next step <span style={{marginLeft:7}}>→</span></button>:<button onClick={onContinue} style={{...buttonStyle,flex:1}}>Got it — choose my apps <span style={{marginLeft:7}}>→</span></button>}</div>
    </div></div>
}
function SetupFlag({ code }: { code:'en'|'cs'|'vi'|'ar-YE' }) {
  const common={position:'absolute' as const,inset:0,overflow:'hidden' as const,borderRadius:5}
  return <span aria-label={{en:'United Kingdom flag',cs:'Czech flag',vi:'Vietnam flag','ar-YE':'Yemen flag'}[code]} role="img" style={{position:'relative',display:'inline-block',width:34,height:24,flexShrink:0,borderRadius:6,overflow:'hidden',boxShadow:'0 2px 7px #0005',border:'1px solid #ffffff35',background:'#fff'}}>
    {code==='en'&&<span style={{...common,background:'#21468b'}}><span style={{position:'absolute',width:'140%',height:7,background:'#fff',left:'-20%',top:8,transform:'rotate(35deg)'}}/><span style={{position:'absolute',width:'140%',height:7,background:'#fff',left:'-20%',top:8,transform:'rotate(-35deg)'}}/><span style={{position:'absolute',inset:'0 12px',background:'#fff'}}/><span style={{position:'absolute',inset:'7px 0',background:'#fff'}}/><span style={{position:'absolute',width:5,height:'100%',left:14,background:'#c8102e'}}/><span style={{position:'absolute',height:5,width:'100%',top:9,background:'#c8102e'}}/></span>}
    {code==='cs'&&<span style={{...common,background:'linear-gradient(to bottom,#fff 0 50%,#d7141a 50% 100%)'}}><span style={{position:'absolute',left:0,top:0,width:0,height:0,borderTop:'12px solid transparent',borderBottom:'12px solid transparent',borderLeft:'17px solid #11457e'}}/></span>}
    {code==='vi'&&<span style={{...common,background:'#da251d'}}><svg viewBox="0 0 100 70" width="100%" height="100%" style={{position:'absolute',inset:0}}><polygon points="50,12 56,34 79,34 60,47 67,66 50,54 33,66 40,47 21,34 44,34" fill="#ffde00"/></svg></span>}
    {code==='ar-YE'&&<span style={{...common,background:'linear-gradient(to bottom,#ce1126 0 33.33%,#fff 33.33% 66.66%,#000 66.66% 100%)'}}/>}
  </span>
}
function SetupAppLogo({ id }: { id:string }) {
  const tile:CSSProperties = id==='DaMusic'
    ? {background:'linear-gradient(145deg,#302247,#130e20)',color:'#c4b5fd'}
    : id==='DaRaw'
    ? {background:'linear-gradient(145deg,#352044,#171020)',color:'#f0abfc'}
    : {background:'linear-gradient(145deg,#151515,#060606)',color:'#facc15'}
  const size=32
  return <span aria-hidden="true" style={{width:44,height:44,flexShrink:0,display:'grid',placeItems:'center',borderRadius:12,...tile,boxShadow:'0 8px 18px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.1)'}}>
    {id==='DaMusic' ? <Music2 size={size} strokeWidth={2.2}/> :
     id==='DaCourt' ? <Scale size={size} strokeWidth={2.2}/> :
     id==='DaRaw' ? <span style={{fontSize:30,lineHeight:1,filter:'drop-shadow(0 2px 3px #0005)'}}>🖌️</span> :
     <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
       <path d="M6 19 24 9l18 10"/><path d="M9 20h30"/><path d="M11 39h26"/><path d="M13 21v15M21 21v15M27 21v15M35 21v15"/><path d="M7 39h34"/>
     </svg>}
  </span>
}
function AppChoiceScreen({ selected, setSelected, onContinue }: { selected:string[]; setSelected:(v:string[])=>void; onContinue:()=>void }) {
  const choices=[['DaMusic','Music','Your playlists and music, right on the desktop.'],['DaEconomy','DaEconomy','Your DaBoys bank, balance, and economy.'],['DaCourt','DaCourt','Trials, cases, and the courtroom.'],['DaRaw','DaRaw','Draw, paint, and create pictures on your desktop.']]
  const toggle=(name:string)=>setSelected(selected.includes(name)?selected.filter(x=>x!==name):[...selected,name])
  return <div style={{...bootStyle,background:'radial-gradient(circle at 50% 35%,rgba(55,65,88,.3),transparent 45%),#080b12',padding:16,boxSizing:'border-box'}}>
    <style>{'@keyframes idaChoiceIn{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes idaLogoFloat{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(-2deg)}}.ida-app-choice{animation:idaChoiceIn .48s cubic-bezier(.2,.8,.2,1) both;transition:transform .2s,border-color .2s,background .2s,box-shadow .2s}.ida-app-choice:hover{transform:translateY(-2px);box-shadow:0 10px 28px #0003}.ida-app-choice[aria-pressed=true]{box-shadow:0 0 0 2px #b9d0ff15,0 8px 22px #0002}.ida-app-choice:hover .ida-choice-logo{animation:idaLogoFloat .8s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.ida-app-choice,.ida-choice-logo{animation:none!important;transition:none!important}}'}</style>
    <div style={{width:'min(620px,calc(100vw - 32px))',maxHeight:'94vh',overflowY:'auto',padding:'clamp(22px,4vw,34px)',boxSizing:'border-box',borderRadius:22,background:'rgba(18,22,32,.93)',border:'1px solid rgba(255,255,255,.1)',boxShadow:'0 28px 90px rgba(0,0,0,.5)',backdropFilter:'blur(20px)',animation:'idaChoiceIn .6s ease both'}}>
      <div style={{display:'flex',justifyContent:'center'}}><Hilal small/></div>
      <div style={{textAlign:'center',marginTop:20}}><div style={{fontSize:'clamp(24px,4vw,29px)',fontWeight:650,letterSpacing:'-.035em'}}>Make IDA yours</div><div style={{margin:'8px auto 0',fontSize:13,lineHeight:1.65,opacity:.65,maxWidth:410}}>Choose the apps you want ready on your desktop. Tap a card to select or deselect it.</div></div>
      <div style={{display:'grid',gap:10,marginTop:24}}>
        {choices.map(([id,label,description],i)=>{const active=selected.includes(id);return <button className="ida-app-choice" aria-pressed={active} key={id} onClick={()=>toggle(id)} style={{animationDelay:(i*85)+'ms',width:'100%',boxSizing:'border-box',display:'flex',alignItems:'center',gap:14,padding:'14px 15px',borderRadius:15,border:active?'1px solid rgba(190,211,255,.8)':'1px solid rgba(255,255,255,.11)',background:active?'linear-gradient(105deg,rgba(135,164,218,.18),rgba(255,255,255,.055))':'rgba(255,255,255,.035)',color:'#fff',cursor:'pointer',textAlign:'left'}}>
          <span className="ida-choice-logo"><SetupAppLogo id={id}/></span><span style={{display:'grid',gap:5,flex:1,minWidth:0}}><span style={{fontSize:15,fontWeight:650}}>{label}</span><span style={{fontSize:12,lineHeight:1.45,opacity:.58}}>{description}</span></span><span style={{width:23,height:23,flexShrink:0,borderRadius:8,border:active?'1px solid #dce7ff':'1px solid #ffffff40',background:active?'#dce7ff':'#ffffff06',display:'grid',placeItems:'center',color:'#111',fontSize:14,fontWeight:900,transition:'all .2s'}}>{active?'✓':''}</span>
        </button>})}
      </div>
      <button onClick={onContinue} style={{...buttonStyle,marginTop:22,display:'flex',alignItems:'center',justifyContent:'center',gap:9}}>{selected.length ? 'Continue with '+selected.length+' '+(selected.length===1?'app':'apps') : 'Continue without extra apps'} <span>→</span></button>
      <div style={{textAlign:'center',marginTop:12,fontSize:11,opacity:.42}}>You can change your apps later in IDA.</div>
    </div>
  </div>
}
function AccountSetup({ selectedApps, onCreated, onSkip }: { selectedApps:string[]; onCreated:(session:IdaSession,displayName:string,apps:string[])=>void; onSkip:()=>void }) {
  const [name,setName]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const submit=async()=>{
    if(password.length<8){setMessage('Use a password with at least 8 characters.');return}
    if(password!==confirm){setMessage('The passwords do not match.');return}
    setBusy(true);setMessage('')
    const {data,error}=await supabase.rpc('ida_create_account',{p_name:name.trim(),p_password:password})
    setBusy(false)
    if(error){setMessage(error.message);return}
    const created=data as IdaSession
    if(created?.account_id&&created?.session_token){
      const next={accountId:created.account_id,sessionToken:created.session_token,displayName:created.display_name||name.trim()}
      writeIdaSession(next)
      onCreated(next,next.displayName,selectedApps)
    } else setMessage('Could not create the IDA account.')
  }
  return <div style={{...bootStyle,background:'radial-gradient(circle at 50% 35%,rgba(55,65,88,.28),transparent 45%),#080b12'}}>
    <div style={{width:'min(410px,calc(100vw - 34px))',padding:'34px 36px 28px',borderRadius:18,background:'rgba(18,22,32,.94)',border:'1px solid rgba(255,255,255,.1)',boxShadow:'0 28px 90px rgba(0,0,0,.5)',backdropFilter:'blur(20px)'}}>
      <style>{'@keyframes idaAccountIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.ida-account-field{transition:border-color .2s,background .2s}.ida-account-field:focus{border-color:rgba(205,222,255,.65)!important;background:rgba(255,255,255,.09)!important}@media(prefers-reduced-motion:reduce){.ida-account-field{transition:none}}'}</style>
      <div style={{textAlign:'center',marginBottom:25,animation:'idaAccountIn .55s ease both'}}><Hilal small/><div style={{fontSize:26,fontWeight:600,marginTop:18,letterSpacing:'-.03em'}}>Create your IDA account</div><div style={{fontSize:12,lineHeight:1.6,opacity:.62,marginTop:7}}>Choose a display name and a password to keep your own desktop and settings together.</div></div>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8,fontSize:12,fontWeight:700,letterSpacing:'.04em',color:'#d9e3f5'}}><span style={{width:24,height:24,borderRadius:8,display:'grid',placeItems:'center',background:'#ffffff12'}}>1</span> YOUR DISPLAY NAME</div>
      <input className="ida-account-field" value={name} onChange={e=>setName(e.target.value)} placeholder="What should IDA call you?" autoComplete="nickname" style={inputStyle}/>
      <div style={{fontSize:11,opacity:.48,marginTop:6}}>This name appears on your IDA welcome and lock screens.</div>
      <div style={{display:'flex',alignItems:'center',gap:9,margin:'18px 0 8px',fontSize:12,fontWeight:700,letterSpacing:'.04em',color:'#d9e3f5'}}><span style={{width:24,height:24,borderRadius:8,display:'grid',placeItems:'center',background:'#ffffff12'}}>2</span> CREATE A PASSWORD</div>
      <input className="ida-account-field" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" type="password" autoComplete="new-password" style={inputStyle}/>
      <div style={{display:'flex',gap:4,marginTop:8}}>{[0,1,2,3].map(n=><span key={n} style={{height:4,flex:1,borderRadius:9,background:password.length===0?'#ffffff18':password.length<8?(n===0?'#e6a1a1':'#ffffff18'):password.length<12?(n<2?'#e7d4a0':'#ffffff18'):'#b7d9bd',transition:'background .2s'}}/>)}</div>
      <div style={{fontSize:11,opacity:.5,marginTop:6}}>{password.length===0?'Use 8 or more characters.':password.length<8?'Keep going — use at least 8 characters.':password.length<12?'Looks good. A longer password is even better.':'Nice — that’s a stronger length.'}</div>
      <div style={{display:'flex',alignItems:'center',gap:9,margin:'18px 0 8px',fontSize:12,fontWeight:700,letterSpacing:'.04em',color:'#d9e3f5'}}><span style={{width:24,height:24,borderRadius:8,display:'grid',placeItems:'center',background:'#ffffff12'}}>3</span> CONFIRM YOUR PASSWORD</div>
      <input className="ida-account-field" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Type the same password again" type="password" autoComplete="new-password" style={inputStyle} onKeyDown={e=>{if(e.key==='Enter')void submit()}}/>
      {confirm.length>0&&<div style={{fontSize:11,marginTop:6,color:confirm===password?'#b7d9bd':'#e6a1a1'}}>{confirm===password?'Passwords match ✓':'These passwords don’t match yet.'}</div>}
      <button disabled={busy||!name||!password||!confirm} onClick={()=>void submit()} style={{...buttonStyle,opacity:(busy||!name||!password||!confirm) ? .5 : 1}}>{busy?'Creating your IDA…':'Create account'}</button>
      {message&&<div style={{marginTop:13,padding:12,borderRadius:10,background:'rgba(255,255,255,.055)',fontSize:12,lineHeight:1.5,opacity:.82}}>{message}</div>}
      <button onClick={onSkip} style={switchStyle}>Skip for now</button>
    </div>
  </div>
}

function ExistingAccount({ onSignedIn, title='Sign in to IDA', initialName='', compact=false }: { onSignedIn:(session:IdaSession)=>void; title?:string; initialName?:string; compact?:boolean }) {
  const [name,setName]=useState(initialName); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  const submit=async()=>{setBusy(true);setMessage('');const {data,error}=await supabase.rpc('ida_sign_in',{p_name:name.trim(),p_password:password});setBusy(false);if(error)setMessage(error.message);else if(data?.account_id&&data?.session_token){const next={accountId:data.account_id,sessionToken:data.session_token,displayName:data.display_name||name.trim()};writeIdaSession(next);onSignedIn(next)}}
  return <div style={{width:'100%'}}>
    {!compact&&<div style={{textAlign:'center',marginBottom:24}}><Hilal small/><div style={{fontSize:25,fontWeight:600,marginTop:17}}>{title}</div></div>}
    {compact&&<div style={{fontSize:20,fontWeight:600,textAlign:'center',marginBottom:18}}>{title}</div>}
    <label style={{fontSize:11,opacity:.55}}>NAME</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your IDA name" style={inputStyle}/>
    <label style={{display:'block',fontSize:11,opacity:.55,marginTop:14}}>PASSWORD</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoFocus style={inputStyle} onKeyDown={e=>{if(e.key==='Enter')void submit()}}/>
    <button disabled={busy||!name||!password} onClick={()=>void submit()} style={{...buttonStyle,opacity:(busy||!name||!password) ? .5 : 1}}>{busy?'Checking…':'Continue'}</button>
    {message&&<div style={{marginTop:13,padding:12,borderRadius:10,background:'rgba(255,255,255,.055)',fontSize:12}}>{message}</div>}
  </div>
}
function playLockWelcomeChime(){try{const AudioContextClass=window.AudioContext||(window as any).webkitAudioContext;if(!AudioContextClass)return;const ctx=new AudioContextClass();const start=ctx.currentTime;const master=ctx.createGain();const lowpass=ctx.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.setValueAtTime(1800,start);master.gain.setValueAtTime(0.0001,start);master.gain.linearRampToValueAtTime(0.22,start+0.32);master.gain.exponentialRampToValueAtTime(0.0001,start+2.25);lowpass.connect(master);master.connect(ctx.destination);const notes=[{f:392,t:0,d:1.65,v:.26},{f:523.25,t:.18,d:1.7,v:.19},{f:659.25,t:.42,d:1.45,v:.11}];for(const n of notes){const osc=ctx.createOscillator();const env=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(n.f,start+n.t);osc.frequency.exponentialRampToValueAtTime(n.f*.997,start+n.t+n.d);env.gain.setValueAtTime(.0001,start+n.t);env.gain.linearRampToValueAtTime(n.v,start+n.t+.22);env.gain.exponentialRampToValueAtTime(.0001,start+n.t+n.d);osc.connect(env);env.connect(lowpass);osc.start(start+n.t);osc.stop(start+n.t+n.d+.03)}void ctx.resume().catch(()=>{});window.setTimeout(()=>{void ctx.close().catch(()=>{})},2800)}catch{}}

function LockScreen({ session, onUnlock }: { session:IdaSession; onUnlock:(next:IdaSession)=>void }) {
  useEffect(()=>{playLockWelcomeChime()},[])
  const [now,setNow]=useState(new Date())
  const [wifiOn,setWifiOn]=useState(()=>{try{return localStorage.getItem('ida-internet-on')!=='0'}catch{return true}})
  const [unlocking,setUnlocking]=useState(false)
  useEffect(()=>{const t=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(t)},[])
  const name=session.displayName||'IDA User'
  const time=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
  const date=now.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'})
  if(unlocking) return <div className="ida-unlock-screen"><style>{`
    @keyframes idaUnlockIn{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}
    @keyframes idaUnlockBg{from{opacity:.4}to{opacity:1}}
    .ida-unlock-screen{position:fixed;inset:0;z-index:999999;background:#05070b;color:#fff;font-family:Segoe UI,system-ui,sans-serif;display:grid;place-items:center;overflow:hidden;animation:idaUnlockBg .45s ease both}
    .ida-unlock-bg{position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.58)),url("${FIRSTBOOT_WALLPAPER}") center/cover;filter:saturate(.85)}
    .ida-unlock-card{position:relative;width:min(390px,calc(100vw - 34px));padding:30px 34px 26px;border-radius:18px;background:transparent;border:0;box-shadow:none;backdrop-filter:none;animation:idaUnlockIn .55s cubic-bezier(.2,.8,.2,1) both}
  `}</style><div className="ida-unlock-bg"/><div className="ida-unlock-card">
    <div style={{textAlign:'center',marginBottom:22}}><div style={{width:72,height:72,borderRadius:'50%',background:'rgba(0,0,0,.38)',border:'1px solid rgba(255,255,255,.4)',display:'grid',placeItems:'center',margin:'0 auto'}}><Hilal small/></div><div style={{fontSize:20,marginTop:13}}>{name}</div><div style={{fontSize:12,opacity:.58,marginTop:5}}>Enter your IDA password</div></div>
    <ExistingAccount title="Unlock IDA" initialName={name} compact onSignedIn={onUnlock}/>
  </div></div>
  return <div onClick={()=>setUnlocking(true)} style={{position:'fixed',inset:0,zIndex:999999,overflow:'hidden',background:'#05070b',color:'#fff',fontFamily:'Segoe UI,system-ui,sans-serif',cursor:'default'}}>
    <style>{`
      @keyframes idaLockIn{from{opacity:0;transform:scale(1.025)}to{opacity:1;transform:none}}
      @keyframes idaLockTime{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}
    `}</style>
    <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.5)),url("${FIRSTBOOT_WALLPAPER}")`,backgroundSize:'cover',backgroundPosition:'center',filter:'saturate(.85)',animation:'idaLockIn .7s ease both'}}/>
    <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 50% 25%,transparent 0,rgba(0,0,0,.18) 45%,rgba(0,0,0,.6) 100%)'}}/>
    <div style={{position:'relative',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:'11vh',textShadow:'0 3px 18px rgba(0,0,0,.55)'}}>
      <div style={{fontSize:'clamp(72px,10vw,118px)',fontWeight:250,letterSpacing:'-.055em',lineHeight:1,animation:'idaLockTime .7s ease both'}}>{time}</div>
      <div style={{fontSize:18,opacity:.9,marginTop:12}}>{date}</div>
      <div style={{marginTop:'12vh',display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{width:76,height:76,borderRadius:'50%',background:'rgba(0,0,0,.38)',border:'1px solid rgba(255,255,255,.4)',display:'grid',placeItems:'center',backdropFilter:'blur(8px)'}}><Hilal small/></div>
        <div style={{fontSize:20,marginTop:14}}>{name}</div>
        <div style={{fontSize:13,opacity:.7,marginTop:6}}>Press anywhere to open IDA</div>
      </div>
    </div>
    <button type="button" onClick={()=>{const next=!wifiOn;setWifiOn(next);try{localStorage.setItem('ida-internet-on',next?'1':'0')}catch{};window.dispatchEvent(new CustomEvent('ida-wifi-change',{detail:{on:next}}))}} style={{position:'absolute',right:22,bottom:20,display:'flex',alignItems:'center',gap:7,fontSize:12,opacity:.9,textShadow:'0 2px 10px rgba(0,0,0,.55)',background:'transparent',border:0,color:'#fff',cursor:'pointer',padding:8,borderRadius:10}} aria-label={wifiOn?'Turn Wi-Fi off':'Turn Wi-Fi on'}><Wifi size={17} strokeWidth={2}/><span>Wi-Fi {wifiOn?'On':'Off'}</span></button>
  </div>
}
function AuthScreen() { return <ExistingAccount onSignedIn={()=>{}}/> }

export function CloudGate() {
  const [session,setSession]=useState<IdaSession|null>(null)
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')
  const [firstBoot,setFirstBoot]=useState(false)
  const [bootStage,setBootStage]=useState<'loading'|'hi'|'working'|'language'|'guide'|'choices'|'install'|'account'|'existing'>('loading')
  const [selectedApps,setSelectedApps]=useState<string[]>(['DaMusic','DaEconomy','DaCourt','DaRaw'])
  const [selectedLanguage,setSelectedLanguage]=useState<LanguageChoice>(()=>{try{const v=localStorage.getItem('ida-language');return v==='cs'||v==='vi'||v==='ar-YE'?v:'en'}catch{return 'en'}})
  const [guideStep,setGuideStep]=useState(0)
  const [desktopOpen,setDesktopOpen]=useState(false)
  const openDesktop=()=>{try{localStorage.setItem('ida-desktop-session-open-v1','1');localStorage.removeItem('ida-power-lock-v1')}catch{};setDesktopOpen(true)}
  const lockDesktop=()=>{try{localStorage.removeItem('ida-desktop-session-open-v1')}catch{};setDesktopOpen(false)}
  const saveTimer=useRef<number|null>(null)
  const saving=useRef(false)
  const queued=useRef(false)
  const activeUser=useRef<string|null>(null)
  const activeSessionToken=useRef<string|null>(null)
  const originalMethods=useRef<{setItem:Storage['setItem'];removeItem:Storage['removeItem'];clear:Storage['clear']}|null>(null)

  const saveNow=async()=>{
    const userId=activeUser.current
    if(!userId)return
    if(saving.current){queued.current=true;return}
    saving.current=true
    try{
      const state=readLocalState()
      const snapshot=JSON.stringify(state)
      const {error:saveError}=await supabase.rpc('ida_save_state',{p_account_id:userId,p_session_token:activeSessionToken.current,p_state:state})
      if(saveError)setError(saveError.message)
      else {
        setError('')
        // Do not clear the marker if a newer edit happened while this save was in flight.
        if(localStorage.getItem(CLOUD_DIRTY_KEY)===userId && JSON.stringify(readLocalState())===snapshot) localStorage.removeItem(CLOUD_DIRTY_KEY)
      }
    }catch(e){setError(e instanceof Error?e.message:'Could not save IDA data.')}
    finally{saving.current=false;if(queued.current){queued.current=false;void saveNow()}}
  }
  const scheduleSave=()=>{
    if(!activeUser.current)return
    if(saveTimer.current!==null)window.clearTimeout(saveTimer.current)
    saveTimer.current=window.setTimeout(()=>{saveTimer.current=null;void saveNow()},650)
  }
  const installStorageSync=()=>{
    if(originalMethods.current)return
    const storage=window.localStorage
    const original={setItem:storage.setItem.bind(storage),removeItem:storage.removeItem.bind(storage),clear:storage.clear.bind(storage)}
    originalMethods.current=original
    storage.setItem=((key:string,value:string)=>{original.setItem(key,value);if(isSyncKey(key)){if(activeUser.current)original.setItem(CLOUD_DIRTY_KEY,activeUser.current);scheduleSave()}}) as Storage['setItem']
    storage.removeItem=((key:string)=>{original.removeItem(key);if(isSyncKey(key)){if(activeUser.current)original.setItem(CLOUD_DIRTY_KEY,activeUser.current);scheduleSave()}}) as Storage['removeItem']
    storage.clear=(()=>{original.clear();if(activeUser.current)original.setItem(CLOUD_DIRTY_KEY,activeUser.current);scheduleSave()}) as Storage['clear']
  }
  const removeStorageSync=()=>{
    const original=originalMethods.current
    if(!original)return
    window.localStorage.setItem=original.setItem
    window.localStorage.removeItem=original.removeItem
    window.localStorage.clear=original.clear
    originalMethods.current=null
  }

  const loadUser=async(nextSession:IdaSession, options:{background?:boolean}={})=>{
    if(!options.background)setReady(false)
    setError('');activeUser.current=nextSession.accountId;activeSessionToken.current=nextSession.sessionToken
    const localBeforeCloud=readLocalState()
    const localChangesPending=localStorage.getItem(CLOUD_DIRTY_KEY)===nextSession.accountId
    // Start observing local edits before the network round-trip so a fast desktop
    // can still save changes without the cloud response overwriting them.
    if(options.background)installStorageSync()
    let resetWindowLayout=false
    try { resetWindowLayout=sessionStorage.getItem('ida-reset-window-layout-once')==='1' } catch {}
    const {data,error:loadError}=await supabase.rpc('ida_load_state',{p_account_id:nextSession.accountId,p_session_token:nextSession.sessionToken})
    if(loadError){
      if(resetWindowLayout){
        try { sessionStorage.removeItem('ida-reset-window-layout-once') } catch {}
      }
      setError('Cloud sync is temporarily unavailable. Your IDA sign-in and local desktop are being kept.');installStorageSync();setReady(true);return
    }
    const localChangesArrivedDuringLoad=localStorage.getItem(CLOUD_DIRTY_KEY)===nextSession.accountId
    if(data&&looksLikeIdaState(data)&&!localChangesPending&&!localChangesArrivedDuringLoad){
      let stateToApply=data
      if(resetWindowLayout){
        const repaired:CloudState={...data,keys:{...data.keys}}
        delete repaired.keys['ida-open-windows-v1']
        delete repaired.keys['ida-active-window-v1']
        stateToApply=repaired
        await supabase.rpc('ida_save_state',{p_account_id:nextSession.accountId,p_session_token:nextSession.sessionToken,p_state:repaired})
      }
      // During fast resume the desktop is already mounted from local storage; do not
      // replace its backing storage underneath the live React state.
      if(!options.background)applyLocalState(stateToApply)
    } else if(Object.keys(localBeforeCloud.keys).length || localChangesPending || localChangesArrivedDuringLoad){
      // Preserve newer local edits instead of replacing them with an older cloud snapshot.
      const stateToSave=localChangesArrivedDuringLoad?readLocalState():localBeforeCloud
      const {error:saveError}=await supabase.rpc('ida_save_state',{p_account_id:nextSession.accountId,p_session_token:nextSession.sessionToken,p_state:stateToSave})
      if(saveError)setError(saveError.message)
      else if(localStorage.getItem(CLOUD_DIRTY_KEY)===nextSession.accountId) localStorage.removeItem(CLOUD_DIRTY_KEY)
    }
    if(resetWindowLayout){
      try { sessionStorage.removeItem('ida-reset-window-layout-once') } catch {}
    }
    installStorageSync();setReady(true)
  }

  const finishNewAccount=(nextSession:IdaSession,name:string,apps:string[])=>{
    try{
      clearLocalState()
      localStorage.setItem('ida-language',selectedLanguage)
      localStorage.setItem('ida-firstboot-complete-v3','1')
      localStorage.setItem('ida-desktop-apps',JSON.stringify(['DAPP','DaFile Explorer','DaSettings','DaTrash',...apps]))
      localStorage.setItem('ida-taskbar',JSON.stringify(['DaSettings']))
    }catch{}
    writeIdaSession(nextSession)
    setSession(nextSession)
    void loadUser(nextSession)
    lockDesktop()
    setBootStage('loading')
  }

  const startInstall=()=>{
    setBootStage('install')
    window.setTimeout(()=>setBootStage('account'),5000)
  }

  useEffect(()=>{
    let mounted=true
    // Only preload wallpapers during first-time setup. Re-downloading six large images
    // on every refresh competes with IDA's startup work and wastes bandwidth.
    const hadFirstBoot=localStorage.getItem('ida-firstboot-complete-v3')==='1'
    const wallpaperUrls=[
      FIRSTBOOT_WALLPAPER,
      'https://images.pexels.com/photos/18928472/pexels-photo-18928472.jpeg?cs=srgb&dl=pexels-bylukemiller-18928472.jpg&fm=jpg',
      'https://images.pexels.com/photos/28737270/pexels-photo-28737270.jpeg?cs=srgb&dl=pexels-simon-steiner-1108932161-28737270.jpg&fm=jpg',
      'https://images.pexels.com/photos/12490458/pexels-photo-12490458.jpeg?cs=srgb&dl=pexels-andrey-yudkin-63325015-12490458.jpg&fm=jpg',
      'https://images.pexels.com/photos/8776172/pexels-photo-8776172.jpeg?cs=srgb&dl=pexels-alexmaksin55-8776172.jpg&fm=jpg',
      'https://images.pexels.com/photos/7348417/pexels-photo-7348417.jpeg?auto=compress&cs=tinysrgb&w=2400'
    ]
    try { const custom=localStorage.getItem('daapps-custom-wallpaper'); if(custom&&custom.startsWith('data:image/'))wallpaperUrls.push(custom) } catch {}
    const preloadImages=hadFirstBoot?[]:wallpaperUrls.map(src=>{const image=new Image();image.decoding='async';image.src=src;return image})
    setFirstBoot(!hadFirstBoot)
    const stored=readIdaSession()
    if(stored){
      setSession(stored)
      const powerLock=localStorage.getItem('ida-power-lock-v1')==='1'
      const resumeDesktop=!powerLock && localStorage.getItem('ida-desktop-session-open-v1')==='1'
      setDesktopOpen(resumeDesktop)
      // If IDA was already open, render its saved local desktop immediately and
      // synchronize the account snapshot in the background instead of showing a
      // blank/boot screen while waiting for the cloud round-trip.
      if(resumeDesktop)setReady(true)
      void loadUser(stored,{background:resumeDesktop})
    } else {
      setReady(true)
      if(localStorage.getItem(GUEST_LOCK_KEY)==='1'){setSession({accountId:'',sessionToken:'',displayName:'IDA User'});setDesktopOpen(false)}
      else if(hadFirstBoot)setBootStage('existing')
      else{
        setBootStage('loading')
        window.setTimeout(()=>mounted&&setBootStage('hi'),5000)
      }
    }
    return()=>{mounted=false;preloadImages.forEach(image=>{image.onload=null;image.onerror=null});removeStorageSync();if(saveTimer.current!==null)window.clearTimeout(saveTimer.current)}
  },[])

  useEffect(()=>{
    if(!firstBoot||session)return
    if(bootStage==='hi'){
      const t=window.setTimeout(()=>setBootStage('working'),5000)
      return()=>window.clearTimeout(t)
    }
    if(bootStage==='working'){
      const t=window.setTimeout(()=>setBootStage('language'),10000)
      return()=>window.clearTimeout(t)
    }
  },[bootStage,firstBoot,session])

  const accountLabel=useMemo(()=>session?.displayName||'IDA User',[session])
  if(!session){
    if(bootStage==='loading'||bootStage==='hi'||bootStage==='working'||bootStage==='install')return <BootScreen stage={bootStage}/>
    if(bootStage==='language')return <LanguageChoiceScreen selected={selectedLanguage} onSelect={setSelectedLanguage} onContinue={()=>{try{localStorage.setItem('ida-language',selectedLanguage)}catch{};setGuideStep(0);setBootStage('guide')}}/>
    if(bootStage==='guide')return <FullscreenGuide step={guideStep} onNext={()=>setGuideStep(s=>s+1)} onBack={()=>setGuideStep(0)} onContinue={()=>setBootStage('choices')}/>
    if(bootStage==='choices')return <AppChoiceScreen selected={selectedApps} setSelected={setSelectedApps} onContinue={startInstall}/>
    if(bootStage==='account')return <AccountSetup selectedApps={selectedApps} onCreated={finishNewAccount} onSkip={()=>{try{clearLocalState();localStorage.setItem('ida-language',selectedLanguage);localStorage.setItem('ida-firstboot-complete-v3','1');localStorage.setItem(GUEST_LOCK_KEY,'1');localStorage.setItem('ida-desktop-apps',JSON.stringify(['DAPP','DaFile Explorer','DaSettings','DaTrash',...selectedApps]));localStorage.setItem('ida-taskbar',JSON.stringify(['DaSettings']))}catch{};writeIdaSession(null);setSession({accountId:'',sessionToken:'',displayName:'IDA User'});setDesktopOpen(false);lockDesktop()}}/>
    return <ExistingAccount onSignedIn={next=>{try{localStorage.setItem('ida-firstboot-complete-v3','1')}catch{};writeIdaSession(next);setSession(next);void loadUser(next);lockDesktop()}}/>
  }
  if(!ready)return <BootScreen stage="install"/>
  if(!desktopOpen)return <LockScreen session={session} onUnlock={async next=>{try{localStorage.removeItem(GUEST_LOCK_KEY)}catch{};writeIdaSession(next);await loadUser(next);setSession(next);openDesktop()}}/>
  return <><IdaDesktopBoundary><DaApps onRestartToLock={lockDesktop}/></IdaDesktopBoundary>{error&&<div style={{position:'fixed',right:10,bottom:60,zIndex:99998,padding:'8px 12px',borderRadius:10,background:'rgba(150,30,30,.85)',color:'#fff',font:'12px system-ui'}}>Cloud save error: {error}</div>}</>
}
