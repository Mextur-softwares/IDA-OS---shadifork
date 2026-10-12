import DaRawPanel from './DaRawPanel'
import DaWord from './DaWord'
import DaExcellent from './DaExcellent'
import DaPower from './DaPower'
import DaCppCompiler from './DaCppCompiler'
import { Component, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown, ChevronUp, ChevronRight, Download, Gauge, CarFront, Settings as Gear, Music2, Film, Trash2, Moon, Skull, Plus,
  Minus, Pause, Play, Scale, Search, Settings2, SlidersHorizontal, Maximize2, ArrowUpDown,
  Code2, SunMedium, Volume2, VolumeX, Wifi, BatteryFull, Power, Folder, Sparkles, X, FileText, Clipboard, Scissors, Tv, SkipBack, SkipForward, ListMusic, Calculator, Sigma, FilePlus2
} from 'lucide-react'


type AppKind = 'compiler' | 'external' | 'scope' | 'music' | 'settings' | 'explorer' | 'notes' | 'trash' | 'media' | 'store' | 'drift' | 'sans' | 'calculator' | 'paint' | 'word' | 'excellent' | 'power'
type AppItem = { name: string; kind: AppKind; url?: string; tone: 'yellow' | 'violet' | 'blue' | 'slate' }
type Position = { x: number; y: number }
type UserFile = { id:string; name:string; kind:'file'|'note'; location:string; mime?:string; data?:string; blobKey?:string; createdAt:number }
type UserFolder = { id:string; name:string; parent:string; createdAt:number }
type ExplorerFolder = string

const FILE_KEY = 'ida-files-v2'
const readFiles = (): UserFile[] => { try { const raw=localStorage.getItem(FILE_KEY); return raw ? JSON.parse(raw) : [] } catch { return [] } }
const saveFiles = (files: UserFile[]) => { try { localStorage.setItem(FILE_KEY, JSON.stringify(files.map(file => file.blobKey ? ({...file,data:undefined}) : file))) } catch {} }

const VIDEO_DB = 'ida-video-files-v1'
function openVideoDb(): Promise<IDBDatabase> { return new Promise((resolve,reject)=>{ const request=indexedDB.open(VIDEO_DB,1); request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('blobs'))request.result.createObjectStore('blobs')}; request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error||new Error('Could not open IDA video storage')) }) }
function storeVideoBlob(id:string, blob:Blob): Promise<void> { return openVideoDb().then(db=>new Promise((resolve,reject)=>{ const tx=db.transaction('blobs','readwrite'); tx.objectStore('blobs').put(blob,id); tx.oncomplete=()=>{db.close();resolve()}; tx.onerror=()=>{const error=tx.error||new Error('Could not save video');db.close();reject(error)}; tx.onabort=()=>{const error=tx.error||new Error('Video save was cancelled');db.close();reject(error)} })) }
function getVideoBlob(id:string): Promise<Blob|null> { return openVideoDb().then(db=>new Promise((resolve,reject)=>{ const tx=db.transaction('blobs','readonly'); const request=tx.objectStore('blobs').get(id); request.onsuccess=()=>{const result=request.result;db.close();resolve(result instanceof Blob?result:null)}; request.onerror=()=>{const error=request.error||new Error('Could not read saved video');db.close();reject(error)} })) }

const appBaseId = (id:string) => id.split('::')[0]
const appForId = (id:string) => { const exact=APPS.find(a=>a.name===id); if(exact)return exact; const base=appBaseId(id); return APPS.find(a=>a.name===base) }

const APPS: AppItem[] = [
  { name: 'DAPP', kind: 'store', tone: 'violet' },
  { name: 'DaEconomy', kind: 'external', url: 'https://xt0tiedcmrq9i5amck0jexb0.macaly.app/', tone: 'yellow' },
  { name: 'DaCourt', kind: 'external', url: 'https://jquv9w2u2tbwtpi6qdd4ze7n.macaly.app/', tone: 'yellow' },
  { name: 'DaMusic', kind: 'music', tone: 'violet' },
  { name: 'DaScope', kind: 'scope', tone: 'blue' },
  { name: 'DaFile Explorer', kind: 'explorer', tone: 'blue' },
  { name: 'DaNotes', kind: 'notes', tone: 'slate' },
  { name: 'Da C++ Studio', kind: 'compiler', tone: 'violet' },
  { name: 'DaWord', kind: 'word', tone: 'blue' },
  { name: 'DaExcellent', kind: 'excellent', tone: 'blue' },
  { name: 'DaPower', kind: 'power', tone: 'blue' }, 
  { name: 'DaSettings', kind: 'settings', tone: 'slate' },
  { name: 'DaTrash', kind: 'trash', tone: 'blue' },
  { name: 'DaMedia', kind: 'media', tone: 'blue' },
  { name: 'DaTV', kind: 'external', url: 'https://www.youtube.com/', tone: 'red' },
  { name: 'DaDrift', kind: 'drift', tone: 'blue' },
  { name: 'Bad-Time', kind: 'sans', tone: 'slate' },
  { name: 'Daculator', kind: 'calculator', tone: 'violet' },
  { name: 'DaRaw', kind: 'paint', tone: 'violet' }, 
]

const DEFAULT_POSITIONS: Record<string, Position> = {
  // Use two tidy columns with enough vertical room for the icon tile at default scale.
  // Keeping every built-in app on its own slot also prevents fresh accounts from
  // inheriting the old DaScope / File Explorer overlap.
  DAPP: { x: 3, y: 3 },
  DaEconomy: { x: 3, y: 19 },
  DaCourt: { x: 3, y: 35 },
  DaMusic: { x: 3, y: 51 },
  DaScope: { x: 3, y: 67 },
  'DaFile Explorer': { x: 3, y: 83 },
  DaSettings: { x: 14, y: 3 },
  DaTrash: { x: 14, y: 19 },
  DaNotes: { x: 14, y: 35 },
  DaMedia: { x: 14, y: 51 },
  DaTV: { x: 14, y: 67 },
  DaDrift: { x: 14, y: 83 },
  Daculator: { x: 25, y: 3 },
  DaRaw: { x: 25, y: 19 },
  DaWord: { x: 25, y: 35 },
  DaExcellent: { x: 25, y: 51 },
  DaPower: { x: 25, y: 67 },
  'Da C++ Studio': { x: 25, y: 83 },
}

type DappCatalogItem = { name:string; tagline:string; description:string; category:string; tone:'yellow'|'violet'|'blue'|'slate'|'red'|'amber' }
const DAPP_CATALOG: DappCatalogItem[] = [
  {name:'DaEconomy',tagline:'The official bank of DaBoys',description:'The official bank of the DaBoys group. Work for money, play games, or trade. Buy items in the shop that can benefit you across DaBoys, manage your economy, and build your balance.',category:'Finance',tone:'yellow'},
  {name:'DaCourt',tagline:'Justice, trials, and roles',description:'The official courtroom for DaBoys. Become a judge, prosecutor, lawyer, or take part in cases, trials, and the growing legal world of DaBoys.',category:'Community',tone:'red'},
  {name:'DaMusic',tagline:'Your music, inside IDA',description:'A focused music player for IDA with playlists, playback controls, volume control, and a clean desktop experience.',category:'Entertainment',tone:'violet'},
  {name:'DaScope',tagline:'Search the web, the simple way',description:'DaScope is IDA’s lightweight web search app. Type what you are looking for and DaScope takes you straight to Google for the results, keeping the experience fast and familiar.',category:'Search',tone:'blue'},
  {name:'DaNotes',tagline:'Write it down. Keep it close.',description:'A simple notes workspace for ideas, plans, reminders, and anything else you want to keep inside IDA.',category:'Productivity',tone:'amber'},
  {name:'DaWord',tagline:'A full writing desk for your ideas',description:'Create and edit rich-text documents with a familiar ribbon, headings, tables, lists, links, image insertion, autosave, and export to HTML or plain text.',category:'Productivity',tone:'blue'},
  {name:'DaExcellent',tagline:'A spreadsheet for everything',description:'Build tables, work with formulas, format cells, use multiple worksheets, import CSV files, and export data—all saved alongside your IDA documents.',category:'Productivity',tone:'amber'},
  {name:'DaPower',tagline:'Make presentations that move people',description:'Create slide decks with editable titles and text, themes, slide duplication, speaker notes, presentation mode, and export to HTML or PDF printing. Work is saved with your IDA Documents.',category:'Productivity',tone:'blue'}, 
  {name:'DaTV',tagline:'Your videos, with a TV icon',description:'Watch videos with DaTV. YouTube may need to open in your browser because some sites block embedded playback.',category:'Entertainment',tone:'red'},
  {name:'DaDrift',tagline:'Drift, race, and beat your records',description:'DaDrift is a racing game focused on drifting around tracks, controlling your car, and chasing better times. Upload the DaDrift.html game file to enable playing it inside IDA.',category:'Games',tone:'blue'},
  {name:'Bad-Time',tagline:'Fight Sans inside IDA',description:'Play Bad-Time, the Sans battle game, right inside an IDA window.',category:'Games',tone:'slate'},
  {name:'Daculator',tagline:'A calculator with a little extra power',description:'A polished everyday calculator with an animated scientific mode for powers, roots, trigonometry, logarithms, constants, and parentheses.',category:'Productivity',tone:'violet'},
  {name:'DaRaw',tagline:'Your colourful digital canvas',description:'A paint studio with pencil, brush, marker, spray, eraser, fill bucket, shapes, text, colour picker, adjustable brush size, undo and redo, image import, zoom and PNG export.',category:'Creativity',tone:'violet'}, 
]

const WALLPAPERS: Record<string, string> = {
  'Moonlit Dunes': 'https://images.pexels.com/photos/7025657/pexels-photo-7025657.jpeg?cs=srgb&dl=pexels-nasimgs-7025657.jpg&fm=jpg',
  'Mountain Lake': 'https://images.pexels.com/photos/18928472/pexels-photo-18928472.jpeg?cs=srgb&dl=pexels-bylukemiller-18928472.jpg&fm=jpg',
  'Desert Stars': 'https://images.pexels.com/photos/28737270/pexels-photo-28737270.jpeg?cs=srgb&dl=pexels-simon-steiner-1108932161-28737270.jpg&fm=jpg',
  'Moonlit Sea': 'https://images.pexels.com/photos/12490458/pexels-photo-12490458.jpeg?cs=srgb&dl=pexels-andrey-yudkin-63325015-12490458.jpg&fm=jpg',
  'Moonlit Coast': 'https://images.pexels.com/photos/8776172/pexels-photo-8776172.jpeg?cs=srgb&dl=pexels-alexmaksin55-8776172.jpg&fm=jpg',
  'Night Lake': 'https://images.pexels.com/photos/7348417/pexels-photo-7348417.jpeg?auto=compress&cs=tinysrgb&w=2400',
}

const UI_TRANSLATIONS: Record<'cs'|'vi'|'ar-YE', Record<string,string>> = {
  cs: {
    'Search':'Hledat','Search apps, settings, and more':'Hledat aplikace, nastavení a další','Welcome to IDA':'Vítejte v IDA','Your desktop apps':'Vaše aplikace na ploše','Pinned':'Připnuté','All apps':'Všechny aplikace','Quick access':'Rychlý přístup','Open an app from your desktop or taskbar':'Otevřete aplikaci z plochy nebo hlavního panelu','IDA OS':'IDA OS','Power':'Napájení','Shut down':'Vypnout','Close IDA':'Zavřít IDA','Sleep':'Spánek','Keep IDA open and resume later':'Ponechat IDA otevřenou a pokračovat později','Restart IDA':'Restartovat IDA','Restart the IDA desktop':'Restartovat plochu IDA','Cancel':'Zrušit','Open app':'Otevřít aplikaci','Close app':'Zavřít aplikaci','Remove from taskbar':'Odebrat z hlavního panelu','Refresh':'Obnovit','Rename':'Přejmenovat','Copy':'Kopírovat','Cut':'Vyjmout','Paste':'Vložit','Delete':'Smazat','Open':'Otevřít','Open File':'Otevřít soubor','New':'Nový','New File':'Nový soubor','New Folder':'Nová složka','New Note':'Nová poznámka','IDA settings':'Nastavení IDA','Settings':'Nastavení','Personalize your IDA desktop.':'Přizpůsobte si plochu IDA.','Wallpaper':'Tapeta','Wallpaper rotation':'Rotace tapet','Cycle the night wallpapers automatically.':'Automaticky střídat noční tapety.','Fade between wallpapers':'Plynulý přechod mezi tapetami','Use a soft crossfade when the wallpaper changes.':'Použít jemný přechod při změně tapety.','Include my wallpaper in rotation':'Zařadit moji tapetu do rotace','Your uploaded photo joins the 10-second wallpaper cycle.':'Nahraná fotografie se přidá do 10sekundové rotace tapet.','Upload custom wallpaper':'Nahrát vlastní tapetu','Desktop icon size':'Velikost ikon na ploše','Adjust the size of desktop apps.':'Upravte velikost aplikací na ploše.','Small':'Malé','Default':'Výchozí','Large':'Velké','Extra large':'Extra velké','NOW PLAYING':'PRÁVĚ HRAJE','Battery':'Baterie','Internet':'Internet','On':'Zapnuto','Off':'Vypnuto','Charging':'Nabíjení','Restarting IDA':'Restartování IDA','Don\'t turn off the web':'Nevypínejte web','Almost there...':'Už skoro hotovo...','Shutting down IDA':'Vypínání IDA','Closing IDA...':'Zavírání IDA...','IDA is sleeping':'IDA spí','Open IDA':'Otevřít IDA','Home':'Domů','Desktop':'Plocha','Photos':'Fotografie','Music':'Hudba','Videos':'Videa','Back':'Zpět','No notes yet':'Zatím žádné poznámky','Start writing...':'Začněte psát...','Control Center':'Centrum ovládání','Brightness':'Jas','Volume':'Hlasitost','Language':'Jazyk','Czech':'Čeština','Vietnamese':'Vietnamština','Yemeni Arabic':'Arabština (Jemen)','Restart to apply language change?':'Restartovat pro použití změny jazyka?','The new language will be applied after restart.':'Nový jazyk bude použit po restartu.','Restart':'Restartovat'
  },
  vi: {
    'Search':'Tìm kiếm','Search apps, settings, and more':'Tìm ứng dụng, cài đặt và hơn thế nữa','Welcome to IDA':'Chào mừng đến với IDA','Your desktop apps':'Các ứng dụng trên màn hình','Pinned':'Đã ghim','All apps':'Tất cả ứng dụng','Quick access':'Truy cập nhanh','Open an app from your desktop or taskbar':'Mở ứng dụng từ màn hình hoặc thanh tác vụ','Power':'Nguồn','Shut down':'Tắt máy','Close IDA':'Đóng IDA','Sleep':'Ngủ','Keep IDA open and resume later':'Giữ IDA mở và tiếp tục sau','Restart IDA':'Khởi động lại IDA','Restart the IDA desktop':'Khởi động lại màn hình IDA','Cancel':'Hủy','Open app':'Mở ứng dụng','Close app':'Đóng ứng dụng','Remove from taskbar':'Xóa khỏi thanh tác vụ','Refresh':'Làm mới','Rename':'Đổi tên','Copy':'Sao chép','Cut':'Cắt','Paste':'Dán','Delete':'Xóa','Open':'Mở','Open File':'Mở tệp','New':'Mới','New File':'Tệp mới','New Folder':'Thư mục mới','New Note':'Ghi chú mới','IDA settings':'Cài đặt IDA','Personalize your IDA desktop.':'Cá nhân hóa màn hình IDA.','Wallpaper':'Hình nền','Wallpaper rotation':'Xoay hình nền','Cycle the night wallpapers automatically.':'Tự động đổi hình nền ban đêm.','Fade between wallpapers':'Chuyển mờ giữa các hình nền','Use a soft crossfade when the wallpaper changes.':'Dùng hiệu ứng chuyển mờ khi hình nền thay đổi.','Include my wallpaper in rotation':'Đưa hình nền của tôi vào vòng xoay','Your uploaded photo joins the 10-second wallpaper cycle.':'Ảnh bạn tải lên sẽ tham gia chu kỳ hình nền 10 giây.','Upload custom wallpaper':'Tải hình nền tùy chỉnh','Desktop icon size':'Kích thước biểu tượng','Adjust the size of desktop apps.':'Điều chỉnh kích thước ứng dụng trên màn hình.','Small':'Nhỏ','Default':'Mặc định','Large':'Lớn','Extra large':'Rất lớn','NOW PLAYING':'ĐANG PHÁT','Battery':'Pin','Internet':'Internet','On':'Bật','Off':'Tắt','Charging':'Đang sạc','Restarting IDA':'Đang khởi động lại IDA','Don\'t turn off the web':'Đừng tắt trang web','Almost there...':'Sắp xong...','Shutting down IDA':'Đang tắt IDA','Closing IDA...':'Đang đóng IDA...','IDA is sleeping':'IDA đang ngủ','Open IDA':'Mở IDA','Home':'Trang chủ','Desktop':'Màn hình','Photos':'Ảnh','Music':'Nhạc','Videos':'Video','Back':'Quay lại','No notes yet':'Chưa có ghi chú','Start writing...':'Bắt đầu viết...','Control Center':'Trung tâm điều khiển','Brightness':'Độ sáng','Volume':'Âm lượng','Language':'Ngôn ngữ','Czech':'Tiếng Séc','Vietnamese':'Tiếng Việt','Yemeni Arabic':'Tiếng Ả Rập Yemen','Restart to apply language change?':'Khởi động lại để áp dụng thay đổi ngôn ngữ?','The new language will be applied after restart.':'Ngôn ngữ mới sẽ được áp dụng sau khi khởi động lại.','Restart':'Khởi động lại'
  },
  'ar-YE': {
    'Search':'بحث','Search apps, settings, and more':'البحث عن التطبيقات والإعدادات والمزيد','Welcome to IDA':'مرحباً بك في IDA','Your desktop apps':'تطبيقات سطح المكتب','Pinned':'مثبت','All apps':'كل التطبيقات','Quick access':'وصول سريع','Open an app from your desktop or taskbar':'افتح تطبيقاً من سطح المكتب أو شريط المهام','Power':'الطاقة','Shut down':'إيقاف التشغيل','Close IDA':'إغلاق IDA','Sleep':'السكون','Keep IDA open and resume later':'إبقاء IDA مفتوحاً والمتابعة لاحقاً','Restart IDA':'إعادة تشغيل IDA','Restart the IDA desktop':'إعادة تشغيل سطح مكتب IDA','Cancel':'إلغاء','Open app':'فتح التطبيق','Close app':'إغلاق التطبيق','Remove from taskbar':'إزالة من شريط المهام','Refresh':'تحديث','Rename':'إعادة تسمية','Copy':'نسخ','Cut':'قص','Paste':'لصق','Delete':'حذف','Open':'فتح','Open File':'فتح الملف','New':'جديد','New File':'ملف جديد','New Folder':'مجلد جديد','New Note':'ملاحظة جديدة','IDA settings':'إعدادات IDA','Personalize your IDA desktop.':'خصص سطح مكتب IDA.','Wallpaper':'الخلفية','Wallpaper rotation':'تدوير الخلفيات','Cycle the night wallpapers automatically.':'تبديل الخلفيات الليلية تلقائياً.','Fade between wallpapers':'تلاشي بين الخلفيات','Use a soft crossfade when the wallpaper changes.':'استخدم انتقالاً ناعماً عند تغيير الخلفية.','Include my wallpaper in rotation':'إضافة خلفيتي إلى التدوير','Your uploaded photo joins the 10-second wallpaper cycle.':'ستدخل الصورة التي رفعتها في دورة خلفيات مدتها 10 ثوانٍ.','Upload custom wallpaper':'رفع خلفية مخصصة','Desktop icon size':'حجم أيقونات سطح المكتب','Adjust the size of desktop apps.':'اضبط حجم تطبيقات سطح المكتب.','Small':'صغير','Default':'افتراضي','Large':'كبير','Extra large':'كبير جداً','NOW PLAYING':'يعمل الآن','Battery':'البطارية','Internet':'الإنترنت','On':'تشغيل','Off':'إيقاف','Charging':'جارٍ الشحن','Restarting IDA':'إعادة تشغيل IDA','Don\'t turn off the web':'لا تغلق الويب','Almost there...':'اقتربنا...','Shutting down IDA':'إيقاف IDA','Closing IDA...':'إغلاق IDA...','IDA is sleeping':'IDA في وضع السكون','Open IDA':'فتح IDA','Home':'الرئيسية','Desktop':'سطح المكتب','Photos':'الصور','Music':'الموسيقى','Videos':'الفيديوهات','Back':'رجوع','No notes yet':'لا توجد ملاحظات بعد','Start writing...':'ابدأ الكتابة...','Control Center':'مركز التحكم','Brightness':'السطوع','Volume':'مستوى الصوت','Language':'اللغة','Czech':'التشيكية','Vietnamese':'الفيتنامية','Yemeni Arabic':'العربية (اليمن)','Restart to apply language change?':'أعد التشغيل لتطبيق تغيير اللغة؟','The new language will be applied after restart.':'سيتم تطبيق اللغة الجديدة بعد إعادة التشغيل.','Restart':'إعادة التشغيل'
  }
}

const TRACKS: Array<{ title:string; artist:string; src:string; image?:string }> = [{ title:'Shelter', artist:'IDA Default', src:'/IDA-OS/music/Shelter.mp3', image:'/IDA-OS/music/shelter-cover.svg' }, { title:'Mina Mintip', artist:'IDA Default', src:'/IDA-OS/music/Mina%20Mintip.mp3', image:'/IDA-OS/music/mina-mintip-cover.svg' }, { title:'Kompa Pasion', artist:'IDA Default', src:'/IDA-OS/music/kompa-pasion.mp3', image:'/IDA-OS/music/kompa-pasion-cover.svg' }, { title:'Send them off', artist:'IDA Default', src:'/IDA-OS/music/send-them-off.mp3', image:'/IDA-OS/music/send-them-off-cover.svg' }, { title:'Fireflies', artist:'IDA Default', src:'/IDA-OS/music/fireflies.mp3', image:'/IDA-OS/music/fireflies-cover.jpg' }, { title:'Infinite Amethyst', artist:'IDA Default', src:'/IDA-OS/music/Infinite%20Amethyst.mp3', image:'/IDA-OS/music/infinite-amethyst-cover.svg' }, { title:'Tuff Chinese Rap', artist:'IDA Default', src:'/IDA-OS/music/Tuff%20Chinese%20Rap.mp3', image:'/IDA-OS/music/tuff-chinese-rap-cover.svg' }, { title:'Gut Genug', artist:'IDA Default', src:'/IDA-OS/music/Gut%20Genug.mp3', image:'/IDA-OS/music/gut-genug-cover.svg' }, { title:'Papaoutai', artist:'IDA Default', src:'/IDA-OS/music/Papaoutai.mp3', image:'/IDA-OS/music/papaoutai-cover.svg' }, { title:'Casanova', artist:'IDA Default', src:'/IDA-OS/music/Casanova.mp3', image:'/IDA-OS/music/casanova-cover.svg' }, { title:'Dancin', artist:'IDA Default', src:'/IDA-OS/music/Dancin.mp3', image:'/IDA-OS/music/dancin-cover.svg' }, { title:'MEGALOVANIA', artist:'IDA Default', src:'/IDA-OS/music/MEGALOVANIA.mp3', image:'/IDA-OS/music/megalovania-cover.svg' }]

export function DaApps({onRestartToLock}:{onRestartToLock?:()=>void} = {}) {
  const [mounted, setMounted] = useState(false)
  const [globalNowPlaying, setGlobalNowPlaying] = useState<{title:string;artist:string;image?:string}|null>(null)
  const [mediaNowPlaying, setMediaNowPlaying] = useState<{title:string;artist:string;image?:string;playing:boolean}|null>(null)
  const [globalNowPlayingVisible, setGlobalNowPlayingVisible] = useState(false)
  const [positions, setPositions] = useState(DEFAULT_POSITIONS)
  const [wallpaper, setWallpaper] = useState(WALLPAPERS['Moonlit Dunes'])
  const wallpaperRef = useRef(wallpaper)
  wallpaperRef.current = wallpaper
  const [previousWallpaper, setPreviousWallpaper] = useState<string | null>(null)
  const [wallpaperRotation, setWallpaperRotation] = useState(true)
  const [wallpaperFade, setWallpaperFade] = useState(true)
  const [includeOwnWallpaper, setIncludeOwnWallpaper] = useState(true)
  const [customWallpaper, setCustomWallpaper] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  const [selectedDesktopItem, setSelectedDesktopItem] = useState<{type:'file'|'folder';id:string}|null>(null)
  const [selectedDesktopIds, setSelectedDesktopIds] = useState<string[]>([])
  const [selectedDesktopApps, setSelectedDesktopApps] = useState<string[]>([])
  const [desktopMarquee, setDesktopMarquee] = useState<{x:number;y:number;w:number;h:number;button:0|2}|null>(null)
  const desktopMarqueeRef = useRef<{sx:number;sy:number;button:0|2;dragged:boolean;active:boolean}>({sx:0,sy:0,button:0,dragged:false,active:false})
  const [files, setFiles] = useState<UserFile[]>([])
  const [folders, setFolders] = useState<UserFolder[]>([])
  const [folderApps, setFolderApps] = useState<Record<string,string[]>>({})
  const [desktopApps, setDesktopApps] = useState<string[]>(['DAPP','DaEconomy','DaCourt','DaMusic','DaFile Explorer','DaSettings','DaTrash','Daculator','DaWord','DaExcellent','DaPower','Da C++ Studio'])
  const [clipboard, setClipboard] = useState<{type:'app'|'file'|'folder';id:string;mode:'copy'|'cut'}|null>(null)
  const [trash, setTrash] = useState<Array<{type:'app'|'file'|'folder';id:string;name:string;app?:AppItem;file?:UserFile;folder?:UserFolder;deletedAt:number}>>([])
  const [appLabels, setAppLabels] = useState<Record<string,string>>({})
  const [renaming, setRenaming] = useState<{type:'app'|'file'|'folder';id:string;name:string}|null>(null)
  const [explorerFolder, setExplorerFolder] = useState<ExplorerFolder>('Home')
  const [notes, setNotes] = useState<Record<string,string>>({})
  const [controlOpen, setControlOpen] = useState(false)
  const [brightness, setBrightness] = useState(()=>{try{return Number(localStorage.getItem('ida-brightness')??100)}catch{return 100}})
  const [internetOn, setInternetOn] = useState(true)
  useEffect(()=>{try{const saved=localStorage.getItem('ida-internet-on');if(saved!==null)setInternetOn(saved==='1')}catch{};const onWifi=(e:any)=>setInternetOn(Boolean(e.detail?.on));window.addEventListener('ida-wifi-change',onWifi);return()=>window.removeEventListener('ida-wifi-change',onWifi)},[])
  const setInternetState = (next:boolean) => { setInternetOn(next); try{localStorage.setItem('ida-internet-on',next?'1':'0')}catch{} }
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [batteryCharging, setBatteryCharging] = useState(false)
  const [volume, setVolume] = useState(()=>{try{return Number(localStorage.getItem('ida-volume')??70)}catch{return 70}})
  const [desktop, setDesktop] = useState(false)
  const [taskbarApps, setTaskbarApps] = useState<string[]>(['DaSettings'])
  const [taskbarTheme, setTaskbarTheme] = useState<'default'|'aurora'|'sunset'|'ocean'|'manual'>('default')
  const [taskbarManualColor, setTaskbarManualColor] = useState('#151b2a')
  const [contextMenu, setContextMenu] = useState<{x:number;y:number;scope:'desktop'|'explorer'|'window';app?:AppItem;appId?:string;file?:UserFile;folderItem?:UserFolder;folder?:ExplorerFolder;windowKey?:string}|null>(null)
  const [filePositions, setFilePositions] = useState<Record<string, Position>>({})
  const [explorerPositions, setExplorerPositions] = useState<Record<string, number>>({})
  const [explorerOpenFileId, setExplorerOpenFileId] = useState<string|null>(null)
  const [taskbarMenu, setTaskbarMenu] = useState<{x:number;y:number;name:string;key?:string;running?:boolean}|null>(null)
  const [taskbarPreview, setTaskbarPreview] = useState<string | null>(null)
  const [taskbarPreviewAnchor, setTaskbarPreviewAnchor] = useState<number | null>(null)
  const taskbarHoverTimer = useRef<number | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [windows, setWindows] = useState<Record<string, any>>({})
  const [activeWindow, setActiveWindow] = useState<string|null>(null)
  const [windowsHydrated, setWindowsHydrated] = useState(false)
  const [badTimeWarning, setBadTimeWarning] = useState<{desktopInstance:boolean}|null>(null)
  const [dontAskBadTime, setDontAskBadTime] = useState(false)
  const [iconScale, setIconScale] = useState(1.1)
  const [clock, setClock] = useState(new Date())
  const [powerMenu, setPowerMenu] = useState(false)
  const [sleeping, setSleeping] = useState(false)
  const [shutdown, setShutdown] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [restartProgress, setRestartProgress] = useState(0)
  const [restartStatus, setRestartStatus] = useState('Saving your desktop...')
  const [language, setLanguage] = useState<'en'|'cs'|'vi'|'ar-YE'>('en')
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [languagePrompt, setLanguagePrompt] = useState<'en'|'cs'|'vi'|'ar-YE'|null>(null)

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(min-width: 701px) and (pointer: fine)')
    const syncDesktop = () => setDesktop(mq.matches)
    syncDesktop(); mq.addEventListener?.('change', syncDesktop)
    const tick = window.setInterval(() => setClock(new Date()), 1000)
    // Paint the desktop first; restore persisted settings and window state on the next frame.
    const restoreFrame = window.requestAnimationFrame(() => {
    try {
      const savedPositions = localStorage.getItem('daapps-positions')
      const savedLanguage = localStorage.getItem('ida-language') as 'en'|'cs'|'vi'|'ar-YE'|null
      if (savedLanguage && ['en','cs','vi','ar-YE'].includes(savedLanguage)) setLanguage(savedLanguage)
      const savedWallpaper = localStorage.getItem('daapps-wallpaper')
      const savedCustom = localStorage.getItem('daapps-custom-wallpaper')
      const savedRotation = localStorage.getItem('ida-wallpaper-rotation-v2')
      const savedFade = localStorage.getItem('ida-wallpaper-fade')
      const savedOwn = localStorage.getItem('ida-wallpaper-own')
      if (savedRotation !== null) setWallpaperRotation(savedRotation === '1')
      if (savedFade !== null) setWallpaperFade(savedFade === '1')
      if (savedOwn !== null) setIncludeOwnWallpaper(savedOwn === '1')
      if (savedPositions) { const saved=JSON.parse(savedPositions); setPositions({ ...DEFAULT_POSITIONS, ...saved }) }
      const savedFilePositions = localStorage.getItem('ida-file-positions')
      if (savedFilePositions) setFilePositions(JSON.parse(savedFilePositions))
      const savedExplorerPositions = localStorage.getItem('ida-explorer-y'); if (savedExplorerPositions) setExplorerPositions(JSON.parse(savedExplorerPositions))
      if (savedCustom) {
        setCustomWallpaper(savedCustom)
        if (savedOwn !== '0') setWallpaper(savedCustom)
        else if (savedWallpaper && WALLPAPERS[savedWallpaper]) setWallpaper(WALLPAPERS[savedWallpaper])
        else setWallpaper(WALLPAPERS[Object.keys(WALLPAPERS)[0]])
      } else if (savedWallpaper && WALLPAPERS[savedWallpaper]) setWallpaper(WALLPAPERS[savedWallpaper])
      const savedTaskbar = localStorage.getItem('ida-taskbar'); if (savedTaskbar) { try { const parsed=JSON.parse(savedTaskbar); if(Array.isArray(parsed)) { const valid=parsed.filter((entry):entry is string=>typeof entry==='string' && (entry.startsWith('file:') ? files.some(f=>f.id===entry.slice(5)) : APPS.some(a=>a.name===appBaseId(entry)))); setTaskbarApps([...new Set(valid)]) } } catch { localStorage.removeItem('ida-taskbar') } }
      const savedTaskbarTheme = localStorage.getItem('ida-taskbar-theme') as 'default'|'aurora'|'sunset'|'ocean'|'manual'|null
      const savedTaskbarColor = localStorage.getItem('ida-taskbar-manual-color')
      if (savedTaskbarTheme && ['default','aurora','sunset','ocean','manual'].includes(savedTaskbarTheme)) setTaskbarTheme(savedTaskbarTheme)
      if (savedTaskbarColor) setTaskbarManualColor(savedTaskbarColor)
      const savedScale = localStorage.getItem('ida-icon-scale'); if (savedScale) { const parsed=Number(savedScale); setIconScale([0.75,0.9,1.1,1.3].includes(parsed)?parsed:1.1) }
      setFiles(readFiles())
      const savedFolders = localStorage.getItem('ida-folders-v1'); if(savedFolders) setFolders(JSON.parse(savedFolders))
      const savedFolderApps = localStorage.getItem('ida-folder-apps-v1'); if(savedFolderApps) setFolderApps(JSON.parse(savedFolderApps))
      const savedDesktopApps = localStorage.getItem('ida-desktop-apps'); if (savedDesktopApps) { const raw=Array.isArray(JSON.parse(savedDesktopApps))?JSON.parse(savedDesktopApps):[]; const normalized=raw.map((id:string)=>typeof id==='string'?id:'').filter(Boolean); setDesktopApps(Array.from(new Set([...normalized,'DaWord','Da C++ Studio']))); try { localStorage.setItem('ida-desktop-apps', JSON.stringify(Array.from(new Set([...normalized,'DaWord'])))) } catch {} }
      const savedLabels = localStorage.getItem('ida-app-labels'); if (savedLabels) setAppLabels(JSON.parse(savedLabels))
      const savedNotes = localStorage.getItem('ida-notes-v2'); if (savedNotes) setNotes(JSON.parse(savedNotes))
      const savedTrash = localStorage.getItem('ida-trash-v1'); if (savedTrash) setTrash(JSON.parse(savedTrash))
      const clearSavedWindows = localStorage.getItem('ida-clear-open-windows-on-start-v1') === '1'
      if (clearSavedWindows) { try { localStorage.removeItem('ida-open-windows-v1'); localStorage.removeItem('ida-active-window-v1'); localStorage.removeItem('ida-clear-open-windows-on-start-v1') } catch {} }
      const savedWindows = clearSavedWindows ? null : localStorage.getItem('ida-open-windows-v1')
      const savedActiveWindow = clearSavedWindows ? null : localStorage.getItem('ida-active-window-v1')
      if (savedWindows) {
        const restored = JSON.parse(savedWindows)
        const rawWindows = restored && typeof restored === 'object' ? restored : {}
        const normalizedWindows = Object.fromEntries(Object.entries(rawWindows).map(([key, value]: [string, any]) => {
          const keyAppName = key.startsWith('taskbar:') || key.startsWith('desktop:') ? key.split(':')[1] : key.split('::')[0]
          const namedApp = APPS.find(a => a.name === key || a.name === value?.appName || a.name === keyAppName)
          if (namedApp?.kind === 'external') {
            return [key, {...value, kind:'external', appName:namedApp.name, externalUrl:value?.externalUrl || namedApp.url, taskbarInstance:value?.taskbarInstance ?? true, appInstanceId:value?.appInstanceId || namedApp.name}]
          }
          if (namedApp?.kind === 'scope') {
            return [key, {...value, kind:'scope', appName:'DaScope', taskbarInstance:value?.taskbarInstance ?? true, appInstanceId:'DaScope'}]
          }
          return [key, value]
        }))
        setWindows(normalizedWindows)
        if (savedActiveWindow && normalizedWindows?.[savedActiveWindow]) setActiveWindow(savedActiveWindow)
      }
    } catch (error) {
      console.error('IDA could not restore saved window layout; resetting only window layout:', error)
      try { localStorage.removeItem('ida-open-windows-v1'); localStorage.removeItem('ida-active-window-v1'); localStorage.removeItem('ida-clear-open-windows-on-start-v1') } catch {}
      setWindows({}); setActiveWindow(null)
    } finally {
      setWindowsHydrated(true)
    }
    })
    return () => { window.cancelAnimationFrame(restoreFrame); mq.removeEventListener?.('change', syncDesktop); window.clearInterval(tick) }
  }, [])

  useEffect(() => {
    let hideTimer: number | undefined
    let removeTimer: number | undefined
    const onNowPlaying = (event: Event) => {
      const detail = (event as CustomEvent<{title:string;artist:string;image?:string}>).detail
      if (!detail) return
      if (hideTimer !== undefined) window.clearTimeout(hideTimer)
      if (removeTimer !== undefined) window.clearTimeout(removeTimer)
      setGlobalNowPlaying(detail)
      setGlobalNowPlayingVisible(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setGlobalNowPlayingVisible(true)))
      hideTimer = window.setTimeout(() => {
        setGlobalNowPlayingVisible(false)
        removeTimer = window.setTimeout(() => setGlobalNowPlaying(current => current === detail ? null : current), 460)
      }, 4200)
    }
    const onMusicState = (event: Event) => { const detail=(event as CustomEvent).detail; setMediaNowPlaying(detail && typeof detail.title==='string' ? detail : null) }
    window.addEventListener('ida-now-playing', onNowPlaying)
    window.addEventListener('ida-music-state', onMusicState)
    return () => {
      window.removeEventListener('ida-music-state', onMusicState)
      window.removeEventListener('ida-now-playing', onNowPlaying)
      if (hideTimer !== undefined) window.clearTimeout(hideTimer)
      if (removeTimer !== undefined) window.clearTimeout(removeTimer)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language === 'cs' ? 'cs' : language === 'vi' ? 'vi' : language === 'ar-YE' ? 'ar-YE' : 'en'
    document.documentElement.dir = language === 'ar-YE' ? 'rtl' : 'ltr'
    if (language === 'en') return
    const map = UI_TRANSLATIONS[language]
    const originals = new WeakMap<Text,string>()
    const translate = (root:Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node:Node|null
      while ((node = walker.nextNode())) {
        const textNode = node as Text
        const parent = textNode.parentElement
        if (!parent || ['SCRIPT','STYLE','NOSCRIPT'].includes(parent.tagName)) continue
        const raw = originals.get(textNode) ?? textNode.nodeValue ?? ''
        if (!raw.trim()) { if (!originals.has(textNode)) originals.set(textNode, raw); continue }
        if (!originals.has(textNode)) originals.set(textNode, raw)
        const clean = raw.trim()
        const translated = map[clean]
        if (translated && textNode.nodeValue !== raw.replace(clean, translated)) {
          textNode.nodeValue = raw.replace(clean, translated)
        }
      }
      document.querySelectorAll<HTMLElement>('[placeholder],[title],[aria-label]').forEach(el => {
        ;(['placeholder','title','aria-label'] as const).forEach(attr => {
          const raw = el.getAttribute(attr)
          if (raw && map[raw]) el.setAttribute(attr, map[raw])
        })
      })
    }
    translate(document.body)
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(n => translate(n))
      }
    })
    observer.observe(document.body,{subtree:true,childList:true})
    return () => observer.disconnect()
  }, [language])

  useEffect(() => {
    const batteryApi = (navigator as Navigator & { getBattery?: () => Promise<any> }).getBattery
    if (!batteryApi) return
    let battery: any
    const updateBattery = () => {
      if (!battery) return
      setBatteryLevel(Math.round(battery.level * 100))
      setBatteryCharging(!!battery.charging)
    }
    batteryApi().then((b:any) => {
      battery = b
      updateBattery()
      b.addEventListener('levelchange', updateBattery)
      b.addEventListener('chargingchange', updateBattery)
    }).catch(() => {})
    return () => {
      battery?.removeEventListener?.('levelchange', updateBattery)
      battery?.removeEventListener?.('chargingchange', updateBattery)
    }
  }, [])

  useEffect(() => {
    if (!windowsHydrated) return
    try {
      localStorage.setItem('ida-open-windows-v1', JSON.stringify(windows))
      if (activeWindow) localStorage.setItem('ida-active-window-v1', activeWindow)
      else localStorage.removeItem('ida-active-window-v1')
    } catch {}
  }, [windows, activeWindow, windowsHydrated])

  const savePositions = (next: Record<string, Position>) => {
    setPositions(next)
    try { localStorage.setItem('daapps-positions', JSON.stringify(next)) } catch {}
  }
  const saveFilePositions = (next: Record<string, Position>) => {
    setFilePositions(next)
    try { localStorage.setItem('ida-file-positions', JSON.stringify(next)) } catch {}
  }
  const saveExplorerPositions = (next: Record<string, number>) => {
    setExplorerPositions(next)
    try { localStorage.setItem('ida-explorer-y', JSON.stringify(next)) } catch {}
  }

  const saveTaskbar = (next: string[]) => { setTaskbarApps(next); try { localStorage.setItem('ida-taskbar', JSON.stringify(next)) } catch {} }
  const saveDesktopApps = (next:string[]) => { setDesktopApps(next); try { localStorage.setItem('ida-desktop-apps', JSON.stringify(next)) } catch {} }
  const removeDesktopShortcut = (id:string) => {
    setDesktopApps(prev => {
      const next = prev.filter(entry => entry !== id)
      try { localStorage.setItem('ida-desktop-apps', JSON.stringify(next)) } catch {}
      return next
    })
    return true
  }
  const isDappInstalled = (name:string) => {
    if(['DaSettings','DaTrash','DaMedia','DAPP'].includes(name)) return true
    const hasShortcut = desktopApps.some(x=>x.split('::')[0]===name) || Object.values(folderApps).some(items=>items.some(x=>x.split('::')[0]===name))
    const hasTrash = trash.some(t=>t.type==='app' && t.id.split('::')[0]===name)
    return hasShortcut || hasTrash
  }
  const uninstallDapp = (name:string) => {
    if(name==='DaSettings' || name==='DaTrash' || name==='DaMedia' || name==='DAPP') return
    saveDesktopApps(desktopApps.filter(x=>x.split('::')[0]!==name))
    const cleaned=Object.fromEntries(Object.entries(folderApps).map(([k,items])=>[k,items.filter(x=>x.split('::')[0]!==name)]))
    commitFolderApps(cleaned)
    saveTrash(trash.filter(t=>!(t.type==='app'&&t.id.split('::')[0]===name)))
    saveTaskbar(taskbarApps.filter(x=>x.split('::')[0]!==name))
    Object.keys(windows).filter(k=>k===name||k.startsWith(name+':')||windows[k]?.appName===name).forEach(closeWindow)
  }
  const commitFiles = (next:UserFile[]) => { setFiles(next); saveFiles(next) }
  const saveOfficeFile = (doc:UserFile) => { const saved:UserFile={...doc,kind:'file',location:doc.location||'Documents',createdAt:Date.now()}; const current=readFiles(); const next=current.some(file=>file.id===saved.id)?current.map(file=>file.id===saved.id?saved:file):[...current,saved]; try { localStorage.setItem(FILE_KEY,JSON.stringify(next.map(file=>file.blobKey?({...file,data:undefined}):file))); setFiles(next); window.dispatchEvent(new CustomEvent('ida-files-changed')); } catch { window.alert('IDA could not save this file. Your browser storage may be full; export a backup and free storage space.'); } }
  const saveDownloadedVideo = async ({name,mime,blob}:{name:string;mime:string;blob:Blob}) => { const id=`video-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; await storeVideoBlob(id,blob); const file:UserFile={id,name,kind:'file',location:'Videos',mime,data:undefined,blobKey:id,createdAt:Date.now()}; setFiles(prev=>{const next=[...prev,file];saveFiles(next);return next}) }
  const commitFolders = (next:UserFolder[]) => { setFolders(next); try { localStorage.setItem('ida-folders-v1', JSON.stringify(next)) } catch {} }
  const commitFolderApps = (next:Record<string,string[]>) => { setFolderApps(next); try { localStorage.setItem('ida-folder-apps-v1', JSON.stringify(next)) } catch {}}
  const updateNotes = (next:Record<string,string>) => { setNotes(next); try { localStorage.setItem('ida-notes-v2', JSON.stringify(next)) } catch {} }
  const saveTrash = (next:typeof trash) => { setTrash(next); try { localStorage.setItem('ida-trash-v1', JSON.stringify(next)) } catch {} }
  const deleteToTrash = (type:'app'|'file'|'folder', id:string) => {
    // IDA-supported apps are still ordinary desktop/file-system shortcuts.
    // Only DaSettings is protected; DaFile Explorer, DaMedia, DaNotes, etc. can have their shortcuts deleted.
    if(type==='app' && !appForId(id)) return
    if(type==='app'){
      const app=appForId(id)
      if(!app) return
      saveDesktopApps(desktopApps.filter(entry => entry !== id))
      saveTrash([...trash.filter(item => !(item.type==='app' && item.id===id)),{type:'app',id,name:appLabels[id]||app.name,app,deletedAt:Date.now()}])
      commitFolderApps(Object.fromEntries(Object.entries(folderApps).map(([k,items])=>[k,items.filter(n=>n!==id)])))
      Object.keys(windows).filter(k=>k===id||k===appBaseId(id)||windows[k]?.appInstanceId===id||windows[k]?.appInstanceId===appBaseId(id)).forEach(closeWindow)
    }
    else if(type==='folder'){ const folder=folders.find(f=>f.id===id); if(!folder)return; saveTrash([...trash,{type:'folder',id,name:folder.name,folder,deletedAt:Date.now()}]); commitFolders(folders.filter(f=>f.id!==id)); commitFolderApps(Object.fromEntries(Object.entries(folderApps).filter(([k])=>k!==id))); closeWindow(id) }
    else { const file=files.find(f=>f.id===id); if(!file)return; saveTrash([...trash,{type:'file',id,name:file.name,file,deletedAt:Date.now()}]); commitFiles(files.filter(f=>f.id!==id)); const nextNotes={...notes}; delete nextNotes[id]; updateNotes(nextNotes); closeWindow(id) }
  }
  const restoreFromTrash = (item:typeof trash[number]) => { if(item.type==='app'&&item.app){const exists=desktopApps.includes(item.id); if(!exists)saveDesktopApps([...desktopApps,item.id])} if(item.type==='file'&&item.file)commitFiles([...files,item.file]); if(item.type==='folder'&&item.folder)commitFolders([...folders,item.folder]); saveTrash(trash.filter(t=>!(t.type===item.type&&t.id===item.id))) }
  const emptyTrash = () => {
    const permanentlyDeletedApps = new Set(trash.filter(item=>item.type==='app' && item.id!=='DaTrash' && item.id!=='DaSettings').map(item=>item.id))
    if (permanentlyDeletedApps.size) saveTaskbar(taskbarApps.filter(name=>!permanentlyDeletedApps.has(name)))
    saveTrash(trash.filter(item=>item.type==='app' && (item.id==='DaSettings'||item.id==='DaTrash')))
  }
  const canPlaceDesktopTile = (type:'app'|'file'|'folder', id:string, pos:Position) => {
    const area = document.querySelector('.home-screen')?.getBoundingClientRect()
    if (!area) return true
    const size = 92 * iconScale
    const gap = 5
    const x = pos.x / 100 * area.width
    const y = pos.y / 100 * area.height
    const overlaps = (other:Position) => {
      const ox = other.x / 100 * area.width
      const oy = other.y / 100 * area.height
      return x < ox + size - gap && x + size - gap > ox && y < oy + size - gap && y + size - gap > oy
    }
    for (const appName of desktopApps) if (type!=='app' || appName!==id) if (overlaps(positions[appName] || DEFAULT_POSITIONS[appName])) return false
    for (const folder of folders.filter(f=>f.parent==='Desktop')) if (!(type==='folder' && folder.id===id)) {
      const index = folders.filter(f=>f.parent==='Desktop').findIndex(f=>f.id===folder.id)
      const other = filePositions[folder.id] || {x:5+(index%5)*15,y:34+Math.floor(index/5)*14}
      if (overlaps(other)) return false
    }
    for (const file of files.filter(f=>f.location==='Desktop')) if (!(type==='file' && file.id===id)) {
      const index = files.filter(f=>f.location==='Desktop').findIndex(f=>f.id===file.id)
      const other = filePositions[file.id] || {x:5+(index%5)*15,y:34+Math.floor(index/5)*14}
      if (overlaps(other)) return false
    }
    return true
  }
  const moveDesktopItem = (type:'app'|'file'|'folder', id:string, pos:Position) => {
    // All desktop items follow the same drag rule: move freely while held,
    // then settle into the nearest available grid slot when released.
    const area = document.querySelector('.home-screen')?.getBoundingClientRect()
    if (area && area.width > 0 && area.height > 0) {
      const tileW = 92 * iconScale
      const tileH = 92 * iconScale
      const stepX = Math.max(7, (tileW / area.width) * 100 + 0.5)
      const stepY = Math.max(10, (tileH / area.height) * 100 + 0.5)
      const candidates: Array<{p:Position;distance:number}> = []
      for (let y=2; y<=Math.max(2, 91-stepY); y+=stepY) {
        for (let x=2; x<=Math.max(2, 96-stepX); x+=stepX) {
          const candidate={x,y}
          if (!canPlaceDesktopTile(type,id,candidate)) continue
          const dx=(candidate.x-pos.x)*area.width/100
          const dy=(candidate.y-pos.y)*area.height/100
          candidates.push({p:candidate,distance:dx*dx+dy*dy})
        }
      }
      candidates.sort((a,b)=>a.distance-b.distance)
      if (candidates[0]) {
        if (type==='app') savePositions({...positions,[id]:candidates[0].p})
        else saveFilePositions({...filePositions,[id]:candidates[0].p})
        return
      }
    }
    if (canPlaceDesktopTile(type,id,pos)) {
      if (type==='app') savePositions({...positions,[id]:pos})
      else saveFilePositions({...filePositions,[id]:pos})
    }
  }
  const pasteClipboard = (location:ExplorerFolder='Desktop') => {
    if(!clipboard) return
    const target = location==='Home' ? 'Desktop' : location
    if(clipboard.type==='folder'){
      const source=folders.find(f=>f.id===clipboard.id)
      if(source){
        if(clipboard.mode==='cut') commitFolders(folders.map(f=>f.id===source.id?{...f,parent:target}:f))
        else { const id='folder-'+Date.now()+'-'+Math.random().toString(36).slice(2,7); commitFolders([...folders,{...source,id,parent:target}]); const appsIn=folderApps[source.id]||[]; if(appsIn.length) commitFolderApps({...folderApps,[id]:[...appsIn]}) }
      }
    } else if(clipboard.type==='app'){
      if(clipboard.mode==='cut'){
        const cleaned=Object.fromEntries(Object.entries(folderApps).map(([k,items])=>[k,items.filter(n=>n!==clipboard.id)]))
        if(target==='Desktop'){ commitFolderApps(cleaned); if(!desktopApps.includes(clipboard.id)) saveDesktopApps([...desktopApps,clipboard.id]) }
        else { commitFolderApps({...cleaned,[target]:[...new Set([...(cleaned[target]||[]),clipboard.id])]}); saveDesktopApps(desktopApps.filter(n=>n!==clipboard.id)) }
      } else if(target==='Desktop'){ const copyId=clipboard.id+'::copy-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5); saveDesktopApps([...desktopApps,copyId]) }
      else { const current=folderApps[target]||[]; const copyId=clipboard.id+'::copy-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5); commitFolderApps({...folderApps,[target]:[...current,copyId]}) }
    } else {
      const source=files.find(f=>f.id===clipboard.id)
      if(source){
        if(clipboard.mode==='cut') commitFiles(files.map(f=>f.id===source.id?{...f,location:target}:f))
        else commitFiles([...files,{...source,id:'file-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),location:target}])
      }
    }
    if(clipboard.mode==='cut') setClipboard(null)
  }
  const addNewFile = (location:string='Desktop') => addNewFolder(location)
  const addNewOfficeFile = (app:'word'|'excellent'|'power', location:string='Desktop') => {
    const id=`file-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const createdAt=Date.now();
    let file:UserFile;
    if(app==='word') file={id,name:'Untitled document.daword',kind:'file',location,mime:'application/x-daword',data:'<h1>Untitled document</h1><p><br></p>',createdAt};
    else if(app==='excellent') {
      const sheet={id:'sheet-'+createdAt.toString(36),name:'Sheet1',cells:{} as Record<string,{value:string}>};
      const workbook={id,title:'Untitled workbook',sheets:[sheet],activeSheet:sheet.id,updatedAt:createdAt};
      file={id,name:'Untitled workbook.daexcel',kind:'file',location,mime:'application/x-daexcellent',data:JSON.stringify(workbook),createdAt};
    } else {
      const slideId='slide-'+createdAt.toString(36);
      const deck={id,title:'Untitled presentation',theme:'Ocean',transition:'fade',updatedAt:createdAt,slides:[{id:slideId,layout:'title',kicker:'',title:'Untitled slide',body:'Add your ideas here.',notes:'',}]};
      file={id,name:'Untitled presentation.dapower',kind:'file',location,mime:'application/x-dapower',data:JSON.stringify(deck),createdAt};
    }
    commitFiles([...files,file]);
    openUserFile(file);
    setContextMenu(null);
    return id;
  }
  const addNewFolder = (parent:string='Desktop') => { const id=`folder-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; commitFolders([...folders,{id,name:'New Folder',parent,createdAt:Date.now()}]); return id }
  const addNote = (location:string='Desktop') => { const id=`note-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; const next:UserFile[]=[...files,{id,name:'New Note',kind:'note' as const,location,createdAt:Date.now()}]; commitFiles(next); updateNotes({...notes,[id]:''}); setExplorerFolder(location==='Desktop'?'Desktop':location as ExplorerFolder); return id }
  const importFiles = async (list:FileList|null, location:string) => {
    if(!list?.length)return;
    const added:UserFile[]=[];
    for(const file of Array.from(list)){
      const id=`file-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      const mediaLike=file.type.startsWith('audio/')||file.type.startsWith('video/')||/\.(mp3|m4a|wav|ogg|flac|aac|mp4|webm|mov|m4v)$/i.test(file.name);
      if(mediaLike){
        try{await storeVideoBlob(id,file);added.push({id,name:file.name,kind:'file',location,mime:file.type||( /\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name)?'audio/mpeg':'video/mp4'),blobKey:id,createdAt:Date.now()})}
        catch(error){console.error('IDA could not store imported media:',error);window.alert('IDA could not save '+file.name+'. Please check available browser storage and try again.')}
      }else{
        const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)});
        added.push({id,name:file.name,kind:'file',location,mime:file.type,data,createdAt:Date.now()});
      }
    }
    if(added.length)commitFiles([...files,...added]);
  }
  const saveDaRawImage = (data:string, fileName:string) => { const clean=(fileName||'DaRaw-artwork').replace(/\.(png|jpe?g|webp|gif|bmp)$/i,'').trim()||'DaRaw-artwork'; const file:UserFile={id:`file-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:clean+'.png',kind:'file',location:'Pictures',mime:'image/png',data,createdAt:Date.now()}; commitFiles([...files,file]); return file.id }
  const updateFileData = (id:string,data:string) => commitFiles(files.map(f=>f.id===id?{...f,data}:f))
  const deleteNote = (id:string) => { const nextFiles=files.filter(f=>f.id!==id); commitFiles(nextFiles); const nextNotes={...notes}; delete nextNotes[id]; updateNotes(nextNotes); setExplorerFolder('Notes') }
  const playVolumeTest = (level:number) => { try { const AudioCtx=window.AudioContext||(window as any).webkitAudioContext; if(!AudioCtx)return; const ctx=new AudioCtx(); const master=ctx.createGain(); const now=ctx.currentTime; master.gain.setValueAtTime(0.0001,now); master.gain.exponentialRampToValueAtTime(Math.max(0.006,Math.min(1,level/100)*0.035),now+0.018); master.gain.exponentialRampToValueAtTime(0.0001,now+0.26); master.connect(ctx.destination); const o1=ctx.createOscillator(); const o2=ctx.createOscillator(); o1.type='sine'; o2.type='sine'; o1.frequency.setValueAtTime(660,now); o1.frequency.exponentialRampToValueAtTime(880,now+0.19); o2.frequency.setValueAtTime(990,now); o2.frequency.exponentialRampToValueAtTime(1320,now+0.19); o1.connect(master); o2.connect(master); o1.start(now); o2.start(now); o1.stop(now+0.21); o2.stop(now+0.21); window.setTimeout(()=>ctx.close(),340) } catch {} }
  const renameItem = (type:'app'|'file'|'folder', id:string, name:string) => { const clean=name.trim(); if(!clean){setRenaming(null);return} if(type==='folder')commitFolders(folders.map(f=>f.id===id?{...f,name:clean}:f)); else if(type==='file')commitFiles(files.map(f=>f.id===id?{...f,name:clean}:f)); else { const next={...appLabels,[id]:clean}; setAppLabels(next); try{localStorage.setItem('ida-app-labels',JSON.stringify(next))}catch{} } setRenaming(null) }
  const copyDraggedAppToDesktop = (id:string) => { if (!APPS.some(a=>a.name===id)) return; const copyId=id+'::copy-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5); saveDesktopApps([...desktopApps,copyId]) }
  const moveDraggedItem = (type:'app'|'file'|'folder', id:string, target:string) => {
    if (type==='app') {
      // Move the exact shortcut ID, not its base app ID. This keeps copies independent.
      const cleaned=Object.fromEntries(Object.entries(folderApps).map(([k,items])=>[k,items.filter(n=>n!==id)]))
      if (target==='Desktop') {
        if (!desktopApps.includes(id)) saveDesktopApps([...desktopApps,id])
        commitFolderApps(cleaned)
      } else if (files.some(f=>f.id===target) || folders.some(f=>f.id===target)) {
        const existing=cleaned[target]||[]
        commitFolderApps({...cleaned,[target]:[...new Set([...existing,id])]})
        saveDesktopApps(desktopApps.filter(entry=>entry!==id))
      }
      return
    }
    if (type==='file') { if(target!=='Home' && target!==id) commitFiles(files.map(f=>f.id===id?{...f,location:target}:f)); return }
    if (id===target) return
    const targetFolder=folders.find(f=>f.id===target)
    if (target==='Desktop') commitFolders(folders.map(f=>f.id===id?{...f,parent:'Desktop'}:f))
    else if (targetFolder) commitFolders(folders.map(f=>f.id===id?{...f,parent:target}:f))
  }
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const target=e.target as HTMLElement|null
      if(target?.tagName==='INPUT'||target?.tagName==='TEXTAREA'||target?.isContentEditable) return
      const selected=selectedApp?{type:'app' as const,id:selectedApp}:selectedDesktopItem?selectedDesktopItem:null
      if(e.key.toLowerCase()==='v'&&clipboard){e.preventDefault();pasteClipboard('Desktop');return}
      if(!selected) return
      if(e.key.toLowerCase()==='c'){e.preventDefault();setClipboard({type:selected.type,id:selected.id,mode:'copy'})}
      if(e.key.toLowerCase()==='x'){e.preventDefault();setClipboard({type:selected.type,id:selected.id,mode:'cut'})}
      if(e.key.toLowerCase()==='v'&&clipboard){e.preventDefault();pasteClipboard('Desktop')}
    }
    window.addEventListener('keydown',onKeyDown)
    return ()=>window.removeEventListener('keydown',onKeyDown)
  },[selectedApp,selectedDesktopItem,clipboard])
  const openExplorerFolder = (folderId:string) => {
    const folder=folders.find(f=>f.id===folderId); if(!folder)return
    const k=`DaFile:${folderId}:${Date.now()}`
    setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'explorer',appName:'DaFile Explorer',folderId,minimized:false,maximized:false,x:35+(Object.keys(prev).length%5)*18,y:30+(Object.keys(prev).length%4)*16,width:Math.min(window.innerWidth-40,1050),height:Math.min(window.innerHeight-90,700),z:maxZ+1,taskbarInstance:false}}})
    setActiveWindow(k)
  }
  const openUserFile = (file:UserFile) => {
    if(file.mime==='application/x-dapower'){const k=`DaPower:${file.id}:${Date.now()}`;setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'power',appName:'DaPower',fileId:file.id,minimized:false,maximized:false,x:28,y:22,width:Math.min(window.innerWidth-40,1280),height:Math.min(window.innerHeight-90,820),z:maxZ+1,taskbarInstance:false}}});setActiveWindow(k);return}
    if(file.mime==='application/x-daexcellent'){const k=`DaExcellent:${file.id}:${Date.now()}`;setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'excellent',appName:'DaExcellent',fileId:file.id,minimized:false,maximized:false,x:35,y:25,width:Math.min(window.innerWidth-40,1240),height:Math.min(window.innerHeight-90,790),z:maxZ+1,taskbarInstance:false}}});setActiveWindow(k);return}
    if(file.mime==='application/x-daword'){const k=`DaWord:${file.id}:${Date.now()}`;setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'word',appName:'DaWord',fileId:file.id,minimized:false,maximized:false,x:55,y:35,width:Math.min(window.innerWidth-40,1120),height:Math.min(window.innerHeight-90,760),z:maxZ+1,taskbarInstance:false}}});setActiveWindow(k);return}
    if(file.kind==='note'){const k=`DaNotes:${file.id}:${Date.now()}`;setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'notes',appName:'DaNotes',fileId:file.id,minimized:false,maximized:false,x:80,y:50,width:Math.min(window.innerWidth-40,900),height:Math.min(window.innerHeight-90,650),z:maxZ+1,taskbarInstance:false}}});setActiveWindow(k);return}
    if(file.mime?.startsWith('image/')||file.mime?.startsWith('video/')||file.mime?.startsWith('audio/')||/\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name)){const k=`DaMedia:${file.id}:${Date.now()}`;setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'media',appName:'DaMedia',fileId:file.id,minimized:false,maximized:false,x:80+(Object.keys(prev).length%4)*18,y:50+(Object.keys(prev).length%3)*16,width:Math.min(window.innerWidth-40,1000),height:Math.min(window.innerHeight-90,680),z:maxZ+1,taskbarInstance:false}}});setActiveWindow(k);return}
    if(folderApps[file.id]) { setExplorerFolder(file.id); setExplorerOpenFileId(null) } else { setExplorerFolder(file.location); setExplorerOpenFileId(file.id) }
    const explorer=APPS.find(a=>a.name==='DaFile Explorer'); if(explorer)openApp(explorer)
  }
  const openWebAppInstance = (app: AppItem, allowMultiple=false) => {
    const appId=app.name; const baseApp=appForId(appId); if(!baseApp||baseApp.kind!=='external'||!baseApp.url) return
    app={...baseApp,name:appId}
    if(app.kind!=='external'||!app.url) return
    if(!allowMultiple){
      const existing=Object.entries(windows).filter(([k,w])=>k===app.name||(w?.taskbarInstance===true&&w?.appName===app.name)).sort((a,b)=>(b[1]?.z||0)-(a[1]?.z||0))[0]
      if(existing){ focusWindow(existing[0]); return }
    }
    const k=(allowMultiple?'desktop:':'taskbar:')+app.name+':'+Date.now()
    const instanceUrl=app.url+(app.url.includes('?')?'&':'?')+'idaInstance='+encodeURIComponent(k)
    setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'external',appName:app.name,minimized:false,maximized:false,x:35+(Object.keys(prev).length%4)*24,y:30+(Object.keys(prev).length%3)*20,width:Math.min(window.innerWidth-40,1050),height:Math.min(window.innerHeight-90,700),z:maxZ+1,externalUrl:instanceUrl,taskbarInstance:!allowMultiple,appInstanceId:appId}}})
    setActiveWindow(k)
  }
  const openApp = (app: AppItem, desktopInstance=false) => {
    const requestedId=app.name; const baseApp=appForId(requestedId); if(!baseApp)return
    app={...baseApp,name:requestedId}
    setContextMenu(null); setStartOpen(false); setSearchOpen(false)
    if (app.kind==='store') { const k=requestedId==='DAPP'?'DAPP':'desktop:'+requestedId+':'+Date.now(); setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:prev[k]?{...prev[k],minimized:false,z:maxZ+1}:{kind:'store',appName:'DAPP',minimized:false,maximized:false,x:35,y:30,width:Math.min(window.innerWidth-40,980),height:Math.min(window.innerHeight-90,680),z:maxZ+1,taskbarInstance:false}}}); setActiveWindow(k); return }
    if (app.kind==='trash' && requestedId==='DaTrash') { setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,DaTrash:prev.DaTrash?{...prev.DaTrash,minimized:false,z:maxZ+1}:{kind:'trash',appName:'DaTrash',minimized:false,maximized:false,x:60,y:45,width:Math.min(window.innerWidth-40,900),height:Math.min(window.innerHeight-90,620),z:maxZ+1,taskbarInstance:true}}}); setActiveWindow('DaTrash'); return }
    if (app.kind==='sans') { try { if(localStorage.getItem('ida-bad-time-dont-ask')!=='1') { setDontAskBadTime(false); setBadTimeWarning({desktopInstance}); return } } catch { setDontAskBadTime(false); setBadTimeWarning({desktopInstance}); return } const k=(desktopInstance?'desktop:':'taskbar:')+requestedId+':'+Date.now(); setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'sans',appName:requestedId,minimized:false,maximized:false,x:35,y:30,width:Math.min(window.innerWidth-40,1050),height:Math.min(window.innerHeight-90,720),z:maxZ+1,taskbarInstance:!desktopInstance,appInstanceId:requestedId}}});setActiveWindow(k);return }
    if (app.kind==='scope') { const k=(desktopInstance?'desktop:':'taskbar:')+requestedId+':'+Date.now(); setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'scope',appName:'DaScope',minimized:false,maximized:false,x:45,y:35,width:Math.min(window.innerWidth-40,1050),height:Math.min(window.innerHeight-90,700),z:maxZ+1,taskbarInstance:!desktopInstance}}});setActiveWindow(k);return }
    const k = desktopInstance ? `desktop:${requestedId}:${Date.now()}` : requestedId
    setWindows(prev => { const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0)); const existing=prev[k]; return {...prev,[k]:existing?{...existing,minimized:false,z:maxZ+1}:{kind:app.kind,appName:app.name,minimized:false,maximized:false,x:20 + Object.keys(prev).length*18,y:18 + Object.keys(prev).length*18,width:Math.min(window.innerWidth-40,1050),height:Math.min(window.innerHeight-90,700),z:maxZ+1,taskbarInstance:!desktopInstance,appInstanceId:requestedId}} })
    setActiveWindow(k)
  }
  const patchWindow = (key:string, patch:any) => setWindows(prev => {
    if (!prev[key]) return prev
    const maxZ = Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0))
    return {...prev,[key]:{...prev[key],...patch,z:maxZ+1}}
  })
  const focusWindow = (key:string) => {
    setWindows(prev => {
      if (!prev[key]) return prev
      const maxZ = Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0))
      const next={...prev,[key]:{...prev[key],minimized:false,z:maxZ+1}}
      return next
    })
    setActiveWindow(key)
  }
  const closeWindow = (key:string) => { setWindows(prev => { const n={...prev}; delete n[key]; return n }); setActiveWindow(null); setContextMenu(null) }
  const clearDragGhost = () => {
    document.querySelectorAll('.ida-drag-ghost').forEach(n=>n.remove())
    document.body.style.cursor=''
  }
  const makeDragGhost = (source:HTMLElement) => {
    clearDragGhost()
    const r=source.getBoundingClientRect()
    const ghost=source.cloneNode(true) as HTMLElement
    ghost.classList.add('ida-drag-ghost')
    ghost.style.position='fixed'; ghost.style.left='0'; ghost.style.top='0'
    ghost.style.width=r.width+'px'; ghost.style.height=r.height+'px'; ghost.style.margin='0'
    ghost.style.pointerEvents='none'; ghost.style.zIndex='2147483647'; ghost.style.opacity='.58'
    document.body.appendChild(ghost)
    return ghost
  }

  useEffect(() => {
    if (!mounted || !wallpaperRotation) { setPreviousWallpaper(null); return }
    let fadeTimer:number|undefined, disposed=false
    const entries=Object.entries(WALLPAPERS)
    const rotation=includeOwnWallpaper&&customWallpaper?[...entries,['My wallpaper',customWallpaper] as [string,string]]:entries
    const rotate=()=>{
      if(disposed||rotation.length<2)return
      const current=rotation.findIndex(([,value])=>value===wallpaperRef.current)
      const next=rotation[(current+1+rotation.length)%rotation.length]
      if(!next)return
      const image=new Image()
      const apply=()=>{
        if(disposed)return
        if(fadeTimer!==undefined)window.clearTimeout(fadeTimer)
        if(wallpaperFade)setPreviousWallpaper(wallpaper)
        setWallpaper(next[1])
        if(wallpaperFade)fadeTimer=window.setTimeout(()=>{if(!disposed)setPreviousWallpaper(null)},10000)
        else setPreviousWallpaper(null)
        try{localStorage.setItem('daapps-wallpaper',next[0]==='My wallpaper'?'':next[0])}catch{}
      }
      image.onload=apply
      image.onerror=()=>{if(!disposed){setWallpaper(next[1]);setPreviousWallpaper(null)}}
      image.src=next[1]
      if(image.complete&&image.naturalWidth>0)apply()
    }
    const timer=window.setInterval(rotate,30000)
    return()=>{disposed=true;window.clearInterval(timer);if(fadeTimer!==undefined)window.clearTimeout(fadeTimer);setPreviousWallpaper(null)}
  }, [mounted, wallpaperRotation, wallpaperFade, includeOwnWallpaper, customWallpaper])

  const setTaskbarThemeMode = (theme:'default'|'aurora'|'sunset'|'ocean'|'manual') => {
    setTaskbarTheme(theme)
    try { localStorage.setItem('ida-taskbar-theme', theme) } catch {}
  }
  const setTaskbarManualMode = (color:string) => {
    setTaskbarManualColor(color)
    try { localStorage.setItem('ida-taskbar-manual-color', color) } catch {}
  }

  const setWallpaperRotationMode = (enabled:boolean) => {
    setWallpaperRotation(enabled)
    try { localStorage.setItem('ida-wallpaper-rotation-v2', enabled ? '1' : '0') } catch {}
  }
  const setWallpaperFadeMode = (enabled:boolean) => {
    setWallpaperFade(enabled)
    try { localStorage.setItem('ida-wallpaper-fade', enabled ? '1' : '0') } catch {}
  }
  const setIncludeOwnWallpaperMode = (enabled:boolean) => {
    setIncludeOwnWallpaper(enabled)
    if (!enabled && customWallpaper && wallpaper === customWallpaper) {
      const fallbackName = Object.keys(WALLPAPERS)[0]
      setWallpaper(WALLPAPERS[fallbackName])
      try { localStorage.setItem('daapps-wallpaper', fallbackName) } catch {}
    }
    try { localStorage.setItem('ida-wallpaper-own', enabled ? '1' : '0') } catch {}
  }

  const chooseWallpaper = (name: string) => {
    const next = WALLPAPERS[name]
    if (!next) return
    setWallpaper(next)
    try {
      localStorage.setItem('daapps-wallpaper', name)
      localStorage.setItem('ida-wallpaper-rotation', '0')
      localStorage.removeItem('daapps-custom-wallpaper')
    } catch {}
  }

  const openPowerMenu = () => { setSearchOpen(false); setPowerMenu(v=>!v); setStartOpen(true) }
  const markPowerLock = () => { try { localStorage.setItem('ida-power-lock-v1','1') } catch {} }
  const clearOpenAppsForPowerOff = () => { try { document.querySelectorAll('audio').forEach(audio => { audio.pause(); try { audio.currentTime = 0 } catch {} }); const musicState = JSON.parse(localStorage.getItem('ida-music-state') || '{}'); localStorage.setItem('ida-music-state', JSON.stringify({...musicState, time: 0})); localStorage.setItem('ida-open-windows-v1', '{}'); localStorage.removeItem('ida-active-window-v1'); localStorage.setItem('ida-clear-open-windows-on-start-v1', '1') } catch {} setWindows({}); setActiveWindow(null) }
  const shutdownIDA = () => { clearOpenAppsForPowerOff(); markPowerLock(); setPowerMenu(false); setStartOpen(false); setSearchOpen(false); setContextMenu(null); setShutdown(true); window.setTimeout(() => window.location.replace('about:blank'), 1800) }
  const sleepIDA = () => { markPowerLock(); setPowerMenu(false); setStartOpen(false); setSearchOpen(false); setContextMenu(null); setSleeping(true) }
  const refreshIDA = () => {
    try {
      localStorage.setItem('ida-open-windows-v1', JSON.stringify(windows))
      if (activeWindow && windows[activeWindow]) localStorage.setItem('ida-active-window-v1', activeWindow)
    } catch {}
    setContextMenu(null)
    setStartOpen(false)
    setSearchOpen(false)
    setPowerMenu(false)
    window.setTimeout(() => window.location.reload(), 80)
  }
  const chooseLanguage = (next:'en'|'cs'|'vi'|'ar-YE') => {
    setLanguageMenuOpen(false)
    setLanguagePrompt(next)
  }
  const applyLanguageAndRestart = () => {
    if (!languagePrompt) return
    try { localStorage.setItem('ida-language', languagePrompt) } catch {}
    setLanguage(languagePrompt)
    setLanguagePrompt(null)
    restartIDA()
  }

  const restartIDA = () => {
    clearOpenAppsForPowerOff()
    setPowerMenu(false)
    setStartOpen(false)
    setSearchOpen(false)
    setContextMenu(null)
    setRestarting(true)
    setRestartProgress(0)
    setRestartStatus('Saving your desktop...')
    const started = Date.now()
    let completed = 0
    let finished = false
    const tasks = [
      ...Object.values(WALLPAPERS).map((src) => () => new Promise<void>((resolve) => {
        const image = new Image()
        image.onload = () => resolve()
        image.onerror = () => resolve()
        image.src = src
        if (image.complete) resolve()
      })),
      ...TRACKS.map((track) => () => new Promise<void>((resolve) => {
        const audio = new Audio()
        audio.preload = 'metadata'
        audio.onloadedmetadata = () => { audio.removeAttribute('src'); audio.load(); resolve() }
        audio.onerror = () => resolve()
        audio.src = track.src
        audio.load()
      })),
    ]
    const statusFor = (count:number) => count < Object.keys(WALLPAPERS).length
      ? 'Loading wallpapers...'
      : count < Object.keys(WALLPAPERS).length + TRACKS.length
        ? 'Checking music library...'
        : 'Finishing desktop startup...'
    setRestartStatus('Loading wallpapers...')
    const preload = Promise.all(tasks.map(async (task) => {
      try { await task() } catch {}
      completed += 1
      setRestartProgress(Math.round(completed / tasks.length * 90))
      setRestartStatus(statusFor(completed))
    }))
    const minimumWait = new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, 10000 - (Date.now() - started))))
    Promise.all([preload, minimumWait]).then(() => {
      if (finished) return
      finished = true
      setRestartProgress(100)
      setRestartStatus('Ready. Opening your desktop...')
      window.setTimeout(() => {
        setRestarting(false)
        onRestartToLock?.()
      }, 450)
    })
  }

  const uploadWallpaper = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const source = String(reader.result)
      setCustomWallpaper(source)
      setWallpaper(source)
      try { localStorage.setItem('daapps-custom-wallpaper', source); localStorage.removeItem('daapps-wallpaper') } catch {}
    }
    reader.readAsDataURL(file)
  }


  if (shutdown) return <ShutdownScreen />
  if (sleeping) return <SleepScreen onWake={()=>window.location.reload()} />
  if (restarting) return <RestartScreen progress={restartProgress} status={restartStatus} />

  return (
    <main
      className="daapps-root"
      style={{ background:'#05070d' }}
      onPointerDown={(e) => { if(e.button===0){setContextMenu(null); setTaskbarMenu(null); setStartOpen(false); setSearchOpen(false); setControlOpen(false)} }}
      onContextMenuCapture={(e) => {
        if (!desktop) return
        const target = e.target as HTMLElement
        if (target.closest('.desktop-context') || target.closest('.webapp-frame') || target.closest('.external-app-frame') || target.closest('.taskbar-context')) return
        if (target.closest('.app-window')) return
        const tile = target.closest('.app-tile') as HTMLElement | null
        if (tile) {
          const id = tile.getAttribute('data-app-id') || tile.getAttribute('aria-label') || ''
          const app = appForId(id)
          if (app) { e.preventDefault(); e.stopPropagation(); setContextMenu({x:e.clientX,y:e.clientY,scope:'desktop',app:{...app,name:id},appId:id,folder:'Desktop'}); return }
        }
        const folderTile = target.closest('.desktop-folder-tile') as HTMLElement | null
        const fileTile = target.closest('.desktop-file-tile') as HTMLElement | null
        if (folderTile || fileTile) {
          e.preventDefault()
          e.stopPropagation()
          if (folderTile) {
            const id = folderTile.getAttribute('data-drop-folder')
            const folderItem = folders.find(f => f.id === id)
            if (folderItem) setContextMenu({x:e.clientX,y:e.clientY,scope:'desktop',folderItem,folder:'Desktop'})
          } else if (fileTile) {
            const id = fileTile.getAttribute('data-drop-folder')
            const file = files.find(f => f.id === id)
            if (file) setContextMenu({x:e.clientX,y:e.clientY,scope:'desktop',file,folder:file.location||'Desktop'})
          }
          return
        }
        if (target.closest('.taskbar')) return
        if (target.closest('.home-screen')) { e.preventDefault(); e.stopPropagation(); setContextMenu({x:e.clientX,y:e.clientY,scope:'desktop',folder:'Desktop'}) }
      }}
      onContextMenu={(e) => { if (desktop && e.target===e.currentTarget) { e.preventDefault(); e.stopPropagation(); setContextMenu({x:e.clientX,y:e.clientY,scope:'desktop',folder:'Desktop'}) } }}
    >
      {previousWallpaper && wallpaperFade && <div key={'previous-'+previousWallpaper} className="wallpaper-layer wallpaper-previous" style={{backgroundImage:'url("'+previousWallpaper+'")'}} />}
      <div key={wallpaper} className="wallpaper-layer wallpaper-current" style={{backgroundImage:'url("'+wallpaper+'")'}} />
      <div className="wallpaper-overlay" />
      {brightness < 100 && <div className="brightness-overlay" style={{opacity:Math.max(0,Math.min(1,(100-brightness)/100))}} aria-hidden="true" />}
      <div className="home-screen" onDragOver={e=>{if(e.dataTransfer.types.includes('ida-copy-app') || e.dataTransfer.types.some(t=>t.startsWith('ida-'))){e.preventDefault();e.dataTransfer.dropEffect=e.dataTransfer.types.includes('ida-copy-app')?'copy':'move'}}} onDrop={e=>{e.preventDefault();const copyApp=e.dataTransfer.getData('ida-copy-app');if(copyApp){copyDraggedAppToDesktop(copyApp);return}const type=e.dataTransfer.getData('ida-type') as 'app'|'file'|'folder';const id=e.dataTransfer.getData('ida-id')||e.dataTransfer.getData('ida-app')||e.dataTransfer.getData('ida-file');if(id)moveDraggedItem(type,id,'Desktop')}} onPointerDown={(e) => {
        if(!desktop)return
        if(e.target!==e.currentTarget)return
        const r=e.currentTarget.getBoundingClientRect()
        desktopMarqueeRef.current={sx:e.clientX-r.left,sy:e.clientY-r.top,button:e.button as 0|2,dragged:false,active:true}
        if(e.button===0 && e.target===e.currentTarget){setSelectedApp(null);setSelectedDesktopItem(null);setSelectedDesktopIds([]);setSelectedDesktopApps([]);if(editMode)setEditMode(false)}
        if(e.button===2){e.preventDefault();e.stopPropagation()}
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }} onPointerMove={(e)=>{
        const q=desktopMarqueeRef.current;if(!q.active)return;if(e.buttons!==q.button)return
        const r=e.currentTarget.getBoundingClientRect(),ex=e.clientX-r.left,ey=e.clientY-r.top,w=Math.abs(ex-q.sx),h=Math.abs(ey-q.sy)
        if(w<5&&h<5)return
        q.dragged=true;const x=Math.min(q.sx,ex),y=Math.min(q.sy,ey);setDesktopMarquee({x,y,w,h,button:q.button})
        const box={l:r.left+x,t:r.top+y,r:r.left+x+w,b:r.top+y+h};const ids:string[]=[];const appsIn:string[]=[]
        e.currentTarget.querySelectorAll<HTMLElement>('.desktop-file-tile,.app-tile').forEach(el=>{const b=el.getBoundingClientRect();if(b.right>=box.l&&b.left<=box.r&&b.bottom>=box.t&&b.top<=box.b){if(el.classList.contains('app-tile'))appsIn.push(el.getAttribute('data-app-id')||el.getAttribute('aria-label')||'');else ids.push(el.getAttribute('data-drop-folder')||'')}})
        setSelectedDesktopIds(ids.filter(Boolean));setSelectedDesktopApps(appsIn.filter(Boolean))
      }} onPointerUp={(e)=>{
        const q=desktopMarqueeRef.current;desktopMarqueeRef.current={sx:0,sy:0,button:0,dragged:false,active:false}
        if(q?.active&&q.dragged&&q.button===2){const hit=e.currentTarget.querySelector<HTMLElement>('.app-tile-selected,.desktop-file-tile.app-tile-selected');if(hit){const appId=hit.getAttribute('data-app-id')||hit.getAttribute('aria-label')||'';const app=appForId(appId);const id=hit.getAttribute('data-drop-folder')||'';const file=files.find(f=>f.id===id);const folderItem=folders.find(f=>f.id===id);setContextMenu({x:e.clientX,y:e.clientY,scope:'desktop',app:app?{...app,name:appId}:undefined,appId:appId||undefined,file,folderItem,folder:'Desktop'})}}
        setDesktopMarquee(null)
      }} onContextMenu={(e)=>{e.preventDefault();e.stopPropagation();if(desktop&&!desktopMarqueeRef.current.dragged&&e.target===e.currentTarget)setContextMenu({x:e.clientX,y:e.clientY,scope:'desktop',folder:'Desktop'})}}>        {desktopMarquee && <div className="desktop-selection-marquee" style={{left:desktopMarquee.x,top:desktopMarquee.y,width:desktopMarquee.w,height:desktopMarquee.h}} aria-hidden="true" />}
        {desktopApps.map((desktopEntry,desktopIndex) => { const appName=appBaseId(desktopEntry); const app=appForId(desktopEntry); if(!app)return null; const basePos=positions[app.name]||DEFAULT_POSITIONS[app.name]||{x:3,y:4}; const isCopy=desktopEntry.includes('::copy-'); const displayPos=isCopy&&!positions[desktopEntry]?{x:Math.min(82,basePos.x+Math.min(12,desktopIndex*3)),y:Math.min(82,basePos.y+Math.min(12,desktopIndex*2))}:positions[desktopEntry]||basePos; return (
          <AppTile
            key={desktopEntry}
            app={app}
            displayName={appLabels[desktopEntry] || appLabels[app.name] || app.name}
            position={displayPos}
            editMode={editMode}
            onEdit={() => setEditMode(true)}
            onOpen={() => { if(app.name==='DaScope') openApp({...app,name:desktopEntry},true); else if(app.name==='DaSettings') openApp(app,false); else if(app.kind==='external') openWebAppInstance({...app,name:desktopEntry},true); else openApp({...app,name:desktopEntry},true) }}
            selected={selectedApp === app.name || selectedDesktopApps.includes(desktopEntry) || selectedDesktopApps.includes(app.name)}
            onSelect={() => { setSelectedApp(app.name); setSelectedDesktopItem(null); setSelectedDesktopApps([desktopEntry]); setSelectedDesktopIds([]) }}
            onMove={(pos) => moveDesktopItem('app',desktopEntry,pos)}
            onDropTarget={(target) => moveDraggedItem('app',desktopEntry,target)}
            
            onContext={(x,y) => desktop && setContextMenu({x,y,scope:'desktop',app:{...app,name:desktopEntry},appId:desktopEntry,folder:'Desktop'})}
            scale={desktop ? iconScale : 1}
            shortcutId={desktopEntry}
          />
        )})}
        {desktop && folders.filter(f=>f.parent==='Desktop').map((folder,index)=>{const savedPos=filePositions[folder.id];const pos=savedPos&&!(savedPos.x===5&&savedPos.y===34)?savedPos:{x:18+(index%5)*14,y:10+Math.floor(index/5)*14};return <DesktopFolderTile key={folder.id} folder={folder} scale={iconScale} left={pos.x} top={pos.y} selected={selectedDesktopItem?.type==='folder'&&selectedDesktopItem.id===folder.id || selectedDesktopIds.includes(folder.id)} onSelect={()=>{setSelectedApp(null);setSelectedDesktopItem({type:'folder',id:folder.id});setSelectedDesktopIds([folder.id]);setSelectedDesktopApps([])}} onOpen={()=>openExplorerFolder(folder.id)} onContext={(x,y)=>setContextMenu({x,y,scope:'desktop',folderItem:folder,folder:'Desktop'})} onMove={(p)=>moveDesktopItem('folder',folder.id,p)} onDropTarget={(target)=>moveDraggedItem('folder',folder.id,target)} />})}
        {desktop && files.filter(f=>f.location==='Desktop').map((file,index)=>{
          const savedPos=filePositions[file.id]; const pos=savedPos&&!(savedPos.x===5&&savedPos.y===34)?savedPos:{x:18+(index%5)*14,y:10+Math.floor(index/5)*14}
          return <DesktopFileTile key={file.id} file={file} scale={iconScale} left={pos.x} top={pos.y} selected={selectedDesktopItem?.type==='file'&&selectedDesktopItem.id===file.id || selectedDesktopIds.includes(file.id)} onSelect={()=>{setSelectedApp(null);setSelectedDesktopItem({type:'file',id:file.id});setSelectedDesktopIds([file.id]);setSelectedDesktopApps([])}} onOpen={()=>openUserFile(file)} onContext={(x,y)=>setContextMenu({x,y,scope:'desktop',file,folder:file.id})} onMove={(p)=>moveDesktopItem('file',file.id,p)} onDropTarget={(target,type,sourceId)=>moveDraggedItem(type||'file',sourceId||file.id,target)} />
        })}
      </div>

      {globalNowPlaying && <div role="status" aria-live="polite" style={{position:'fixed',right:22,bottom:78,zIndex:2147483647,width:300,maxWidth:'calc(100vw - 44px)',display:'flex',alignItems:'center',gap:12,padding:12,background:'#242630',color:'#fff',border:'1px solid #41434e',borderRadius:14,boxShadow:'0 12px 38px #0008',pointerEvents:'none',opacity:globalNowPlayingVisible?1:0,transform:globalNowPlayingVisible?'translateX(0) scale(1)':'translateX(90px) scale(.97)',transition:'opacity 420ms cubic-bezier(.22,1,.36,1), transform 460ms cubic-bezier(.22,1,.36,1)',willChange:'transform, opacity'}}>{globalNowPlaying.image?<img src={globalNowPlaying.image} alt="" style={{width:54,height:54,objectFit:'cover',borderRadius:8,flexShrink:0}}/>:<Music2 size={26}/>}<div style={{minWidth:0,flex:1}}><div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,color:'#b6bac5',marginBottom:4}}>NOW PLAYING</div><div style={{fontSize:14,fontWeight:750,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{globalNowPlaying.title}</div><div style={{fontSize:12,color:'#b6bac5',marginTop:3}}>{globalNowPlaying.artist}</div></div></div>}

      {controlOpen && <ControlCenter brightness={brightness} setBrightness={(v)=>{setBrightness(v);try{localStorage.setItem('ida-brightness',String(v))}catch{}}} internetOn={internetOn} setInternetOn={setInternetState} volume={volume} setVolume={(v)=>{setVolume(v);try{localStorage.setItem('ida-volume',String(v))}catch{}}} onVolumeChange={(v)=>{setVolume(v);try{localStorage.setItem('ida-volume',String(v))}catch{};playVolumeTest(v)}} batteryLevel={batteryLevel} batteryCharging={batteryCharging} nowPlaying={mediaNowPlaying} onClose={() => setControlOpen(false)} />}

      {Object.entries(windows).map(([key, win]) => {
        const app = appForId(key) || (win.appName ? appForId(win.appName) : null) || (win.kind==='scope' ? ({name:'DaScope',kind:'scope',tone:'blue'} as AppItem) : win.kind==='media' ? ({name:'DaMedia',kind:'media',tone:'blue'} as AppItem) : win.kind==='notes' ? ({name:'DaNotes',kind:'notes',tone:'slate'} as AppItem) : win.kind==='explorer' ? ({name:folders.find(f=>f.id===win.folderId)?.name||'File',kind:'explorer',tone:'blue'} as AppItem) : (win.fileId ? ({name:files.find(f=>f.id===win.fileId)?.name||key,kind:'external',tone:'blue'} as AppItem) : null))
        if (!app) return null
        const userFile = win.fileId ? files.find(f=>f.id===win.fileId) : undefined
        return <WindowFrame key={key} app={app} state={win} active={activeWindow===key} onContextMenu={win.externalUrl ? undefined : (x,y)=>{setContextMenu({x,y,scope:'window',windowKey:key});setStartOpen(false);setSearchOpen(false);setPowerMenu(false)}} onFocus={()=>focusWindow(key)} onPatch={(p)=>patchWindow(key,p)} onMinimize={()=>patchWindow(key,{minimized:true})} onClose={()=>closeWindow(key)} onMaximize={()=>patchWindow(key,{maximized:!win.maximized})}>
          {win.kind==='sans' ? <BadTimeSimulatorPanel offline={!internetOn}/> : win.kind==='scope' ? <DaScopeSearch offline={!internetOn}/> : app?.name==='DaTV' ? <DaTVPanel offline={!internetOn} volume={volume} onDownloadVideo={saveDownloadedVideo}/> : (win.externalUrl || (app?.kind==='external' && app.url)) ? <WebAppPanel url={win.externalUrl || app.url} offline={!internetOn}/> : (win.kind==='store'||key==='DAPP') ? <DappStore internetOn={internetOn} installed={isDappInstalled} onInstall={(name)=>{saveDesktopApps([...desktopApps.filter(x=>x!==name),name]);saveTaskbar([...taskbarApps.filter(x=>x!==name),name])}} onUninstall={uninstallDapp} onOpen={(name)=>{const a=APPS.find(x=>x.name===name);if(a)openApp(a)}} /> : (key==='DaTrash'||win.kind==='trash') ? <DaTrash trash={trash} onRestore={restoreFromTrash} onEmpty={emptyTrash} onPermanentDelete={(item)=>{if(item.type==='app'&&item.id==='DaSettings')return;saveTrash(trash.filter(t=>!(t.type===item.type&&t.id===item.id)))}}/> : win.kind==='compiler' ? <DaCppCompiler onSaveFile={({name,content})=>saveOfficeFile({id:'cpp-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name,kind:'file',location:'Documents',mime:'text/x-c++src',data:content,createdAt:Date.now()})}/> : win.kind==='word' ? <DaWord files={files} fileId={win.fileId} onSaveDocument={saveOfficeFile} onDeleteDocument={(id)=>deleteToTrash('file',id)}/> : win.kind==='excellent' ? <DaExcellent files={files} fileId={win.fileId} onSaveWorkbook={saveOfficeFile} onDeleteWorkbook={(id)=>deleteToTrash('file',id)}/> : win.kind==='power' ? <DaPower files={files} fileId={win.fileId} onSaveDeck={saveOfficeFile} onDeleteDeck={(id)=>deleteToTrash('file',id)}/> : win.kind==='media' ? <DaMediaSafe file={userFile} volume={volume} onVolumeChange={(v)=>{setVolume(v);try{localStorage.setItem('ida-volume',String(v))}catch{}}} onImportToMusic={(file)=>{const musicApp=APPS.find(a=>a.name==='DaMusic');if(musicApp)openApp(musicApp);window.setTimeout(()=>window.dispatchEvent(new CustomEvent('ida-damusic-import-file',{detail:{file}})),300)}}/> : win.kind==='drift' ? <DaDriftPanel/> : win.kind==='music' ? <DaMusicSafe volume={volume}/> : win.kind==='calculator' ? <DaculatorPanel/> : win.kind==='paint' ? <DaRawPanel photos={files.filter(f=>f.location==='Pictures'&&f.mime?.startsWith('image/'))} onSavePng={saveDaRawImage} onImportImage={(file)=>importFiles([file] as unknown as FileList,'Pictures')}/> : win.kind==='settings' ? <SettingsPanel taskbarTheme={taskbarTheme} taskbarManualColor={taskbarManualColor} onTaskbarTheme={setTaskbarThemeMode} onTaskbarManualColor={setTaskbarManualMode} onPreset={chooseWallpaper} onUpload={uploadWallpaper} iconScale={iconScale} onScale={(v)=>{setIconScale(v);try{localStorage.setItem('ida-icon-scale',String(v))}catch{}}} wallpaperRotation={wallpaperRotation} wallpaperFade={wallpaperFade} includeOwnWallpaper={includeOwnWallpaper} customWallpaper={customWallpaper} onRotation={setWallpaperRotationMode} onFade={setWallpaperFadeMode} onIncludeOwn={setIncludeOwnWallpaperMode}/> : win.kind==='notes' ? <DaNotes files={files} notes={notes} updateNotes={updateNotes} onNewNote={()=>addNote('Notes')} onDeleteNote={deleteNote} fileId={win.fileId}/> : win.kind==='explorer' ? <DaFileExplorer folder={win.folderId} setFolder={(next)=>patchWindow(key,{folderId:next})} files={files} folders={folders} folderApps={folderApps} appLabels={appLabels} apps={APPS} desktopApps={desktopApps} onImport={importFiles} onNewFile={addNewFile} onNewFolder={addNewFolder} onNewNote={addNote} onMoveFile={(id,location)=>folders.some(f=>f.id===id)?commitFolders(folders.map(f=>f.id===id?{...f,parent:location}:f)):commitFiles(files.map(x=>x.id===id?{...x,location}:x))} onMoveApp={(id,location)=>moveDraggedItem('app',id,location)} onEditFile={updateFileData} explorerPositions={explorerPositions} onExplorerMove={(id,y)=>saveExplorerPositions({...explorerPositions,[id]:y})} onOpen={openUserFile} onOpenApp={openApp} onContext={(x,y,item)=>setContextMenu({x,y,scope:'explorer',...item,folder:item.folderItem?.id||item.file?.location||win.folderId||explorerFolder})} onCopy={(type,id)=>{setClipboard({type,id,mode:'copy'});setContextMenu(null)}} onCut={(type,id)=>{setClipboard({type,id,mode:'cut'});setContextMenu(null)}} onPaste={()=>pasteClipboard(win.folderId||explorerFolder)} onDelete={(type,id)=>deleteToTrash(type,id)} onDeleteMany={(ids)=>{const chosen=files.filter(file=>ids.includes(file.id));if(chosen.length){saveTrash([...trash,...chosen.map(file=>({type:'file' as const,id:file.id,name:file.name,file,deletedAt:Date.now()}))]);commitFiles(files.filter(file=>!ids.includes(file.id)));chosen.forEach(file=>closeWindow(file.id))}}} onAddDesktop={(id)=>{if(!desktopApps.includes(id))saveDesktopApps([...desktopApps,id])}} openFileId={null} setOpenFileId={()=>{}}/> : key==='DaMusic' ? <MusicPanel volume={volume}/> : key==='DaSettings' ? <SettingsPanel taskbarTheme={taskbarTheme} taskbarManualColor={taskbarManualColor} onTaskbarTheme={setTaskbarThemeMode} onTaskbarManualColor={setTaskbarManualMode} onPreset={chooseWallpaper} onUpload={uploadWallpaper} iconScale={iconScale} onScale={(v)=>{setIconScale(v);try{localStorage.setItem('ida-icon-scale',String(v))}catch{}}} wallpaperRotation={wallpaperRotation} wallpaperFade={wallpaperFade} includeOwnWallpaper={includeOwnWallpaper} customWallpaper={customWallpaper} onRotation={setWallpaperRotationMode} onFade={setWallpaperFadeMode} onIncludeOwn={setIncludeOwnWallpaperMode}/> : key==='DaFile Explorer' ? <DaFileExplorer folder={explorerFolder} setFolder={setExplorerFolder} files={files} folders={folders} folderApps={folderApps} appLabels={appLabels} apps={APPS} desktopApps={desktopApps} onImport={importFiles} onNewFile={addNewFile} onNewFolder={addNewFolder} onNewNote={addNote} onMoveFile={(id,location)=>folders.some(f=>f.id===id)?commitFolders(folders.map(f=>f.id===id?{...f,parent:location}:f)):commitFiles(files.map(x=>x.id===id?{...x,location}:x))} onMoveApp={(id,location)=>moveDraggedItem('app',id,location)} onEditFile={updateFileData} explorerPositions={explorerPositions} onExplorerMove={(id,y)=>saveExplorerPositions({...explorerPositions,[id]:y})} onOpen={openUserFile} onOpenApp={openApp} onContext={(x,y,item)=>setContextMenu({x,y,scope:'explorer',...item,folder:item.folderItem?.id||item.file?.id||item.file?.location||explorerFolder})} onCopy={(type,id)=>{setClipboard({type,id,mode:'copy'});setContextMenu(null)}} onCut={(type,id)=>{setClipboard({type,id,mode:'cut'});setContextMenu(null)}} onPaste={()=>pasteClipboard(explorerFolder)} onDelete={(type,id)=>deleteToTrash(type,id)} onAddDesktop={(id)=>{if(!desktopApps.includes(id))saveDesktopApps([...desktopApps,id])}} openFileId={explorerOpenFileId} setOpenFileId={setExplorerOpenFileId}/> : (key==='DaNotes'||key.startsWith('DaNotes:')) ? <DaNotes files={files} notes={notes} updateNotes={updateNotes} onNewNote={()=>addNote('Notes')} onDeleteNote={deleteNote} fileId={win.fileId}/> : userFile?.mime?.startsWith('image/') ? <div className="file-preview"><img src={userFile.data} alt={userFile.name}/></div> : userFile?.mime?.startsWith('video/') ? <div className="file-preview"><video src={userFile.data} controls/></div> : <div className="file-preview file-text-preview">Blank file</div>}
        </WindowFrame>
      })}
      {desktop && <IDATaskbar files={files} onOpenFile={openUserFile} taskbarTheme={taskbarTheme} taskbarManualColor={taskbarManualColor} onReorder={saveTaskbar} onLogoDrop={copyDraggedAppToDesktop} apps={taskbarApps} openApps={Object.keys(windows)} windowsForTaskbar={windows} windowLabels={Object.fromEntries(Object.entries(windows).filter(([k])=>k.includes(':')||k==='DaTrash').map(([k,w])=>[k,w.kind==='external'?(w.appName||k):w.kind==='explorer'?(folders.find(f=>f.id===w.folderId)?.name||'File'):k==='DaTrash'?'DaTrash':files.find(f=>f.id===w.fileId)?.name||'Window']))} active={activeWindow} clock={clock} onWindow={(k)=>{ const w=windows[k]; if(!w) return; if(activeWindow===k && !w.minimized){ patchWindow(k,{minimized:true}); setActiveWindow(null); } else { focusWindow(k); } }}
        onStart={()=>{setSearchOpen(false);setPowerMenu(false);setStartOpen(v=>!v)}}
        onSearch={()=>{setStartOpen(false);setPowerMenu(false);setSearchOpen(v=>!v)}}
        onApp={(n)=>{const existing=Object.entries(windows).filter(([k,w])=>k===n || (w?.taskbarInstance===true&&w?.appName===n)).sort((a,b)=>(b[1]?.z||0)-(a[1]?.z||0))[0];if(existing){const [k,w]=existing;const app=APPS.find(x=>x.name===n);if(app?.kind==='external'&&(w?.kind!=='external'||!w?.externalUrl))patchWindow(k,{kind:'external',appName:app.name,externalUrl:app.url,taskbarInstance:true,appInstanceId:app.name,minimized:false});if(activeWindow===k&&!w.minimized){patchWindow(k,{minimized:true});setActiveWindow(null)}else{focusWindow(k)}return}const a=APPS.find(x=>x.name===n);if(a)openApp(a)}}
        onControl={()=>setControlOpen(v=>!v)}
        language={language}
        languageMenuOpen={languageMenuOpen}
        onLanguageMenu={()=>setLanguageMenuOpen(v=>!v)}
        onLanguage={chooseLanguage}
        onTaskbarContext={(x,y,n,key)=>{const latest=Object.entries(windows).filter(([k,w])=>(k===n||w?.appName===n)&&w?.taskbarInstance===true).sort((a,b)=>(b[1]?.z||0)-(a[1]?.z||0))[0];setStartOpen(false);setSearchOpen(false);setPowerMenu(false);setTaskbarMenu({x,y,name:n,key:latest?.[0]||key,running:!!latest})}}
        onTaskbarHover={(key,anchor)=>{if(taskbarHoverTimer.current)window.clearTimeout(taskbarHoverTimer.current);taskbarHoverTimer.current=window.setTimeout(()=>{setTaskbarPreview(key);setTaskbarPreviewAnchor(anchor??null)},550)}}
        onTaskbarLeave={()=>{if(taskbarHoverTimer.current)window.clearTimeout(taskbarHoverTimer.current);taskbarHoverTimer.current=window.setTimeout(()=>{setTaskbarPreview(null);setTaskbarPreviewAnchor(null)},280)}}/>} 
      {desktop && taskbarPreview && <TaskbarPreview windowKey={taskbarPreview} win={windows[taskbarPreview]} app={windows[taskbarPreview]?.appName?APPS.find(a=>a.name===windows[taskbarPreview].appName):APPS.find(a=>a.name===taskbarPreview)} anchor={taskbarPreviewAnchor} onClose={()=>{closeWindow(taskbarPreview);setTaskbarPreview(null);setTaskbarPreviewAnchor(null)}} onEnter={()=>{if(taskbarHoverTimer.current)window.clearTimeout(taskbarHoverTimer.current)}} onLeave={()=>{setTaskbarPreview(null);setTaskbarPreviewAnchor(null)}} />}
      {desktop && startOpen && <StartMenu apps={APPS.filter(a=>!DAPP_CATALOG.some(d=>d.name===a.name)||isDappInstalled(a.name))} onOpen={openApp} powerOpen={powerMenu} onPower={openPowerMenu} onShutdown={shutdownIDA} onSleep={sleepIDA} onRestart={restartIDA} onCancel={()=>setPowerMenu(false)} onLock={()=>onRestartToLock?.()}/>}
      {desktop && searchOpen && <SearchPanel apps={APPS.filter(a=>!DAPP_CATALOG.some(d=>d.name===a.name)||isDappInstalled(a.name))} query={search} setQuery={setSearch} onOpen={openApp}/>} 
      {contextMenu?.scope==='window' ? <NativeWindowContextMenu menu={contextMenu} onMinimize={()=>{if(contextMenu.windowKey)patchWindow(contextMenu.windowKey,{minimized:true});setContextMenu(null)}} onClose={()=>{if(contextMenu.windowKey)closeWindow(contextMenu.windowKey)}}/> : contextMenu && <DesktopContextMenu menu={contextMenu} taskbarApps={taskbarApps} clipboard={clipboard} onAdd={(n)=>{const appName=appBaseId(n);saveTaskbar([...new Set([...taskbarApps,appName])]);setContextMenu(null)}} onAddFile={(id)=>{const key='file:'+id;saveTaskbar([...new Set([...taskbarApps,key])]);setContextMenu(null)}} onRemove={(n)=>{saveTaskbar(taskbarApps.filter(x=>x!==n));setContextMenu(null)}} onRefresh={refreshIDA} onNewFile={()=>{const target=contextMenu?.folderItem?.id||contextMenu?.folder||'Desktop';addNewFile(target);setContextMenu(null)}} onNewFolder={()=>{const target=contextMenu?.folderItem?.id||contextMenu?.folder||'Desktop';addNewFolder(target);setContextMenu(null)}} onNewNote={()=>{addNote((contextMenu?.folder==='Home'?'Desktop':contextMenu?.folder||'Desktop') as 'Desktop'|'Pictures'|'Music'|'Videos');setContextMenu(null)}} onNewOfficeFile={(app,location)=>addNewOfficeFile(app,location||'Desktop')} onOpen={(a)=>{openApp(a);setContextMenu(null)}} onOpenFile={(f)=>{openUserFile(f);setContextMenu(null)}} onOpenFolder={(f)=>{setExplorerFolder(f.id);setExplorerOpenFileId(null);const explorer=APPS.find(a=>a.name==='DaFile Explorer');if(explorer)openApp(explorer);setContextMenu(null)}} onRename={(item)=>{setContextMenu(null);setRenaming(item)}} onSettings={()=>openApp(APPS.find(a=>a.name==='DaSettings')!)} onCopy={(type,id)=>{setClipboard({type,id,mode:'copy'});setContextMenu(null)}} onCut={(type,id)=>{setClipboard({type,id,mode:'cut'});setContextMenu(null)}} onDelete={(type,id)=>{deleteToTrash(type,id);setContextMenu(null)}} onPaste={()=>{pasteClipboard(contextMenu.folder||'Desktop');setContextMenu(null)}}/>}
      {desktop && taskbarMenu && <TaskbarContextMenu menu={taskbarMenu} onRemove={()=>{if(!taskbarMenu.key||taskbarMenu.key===taskbarMenu.name)saveTaskbar(taskbarApps.filter(x=>x!==taskbarMenu.name));setTaskbarMenu(null)}} onOpen={()=>{const existing=Object.entries(windows).filter(([k,w])=>k===taskbarMenu.name||w?.taskbarInstance===true&&w?.appName===taskbarMenu.name).sort((a,b)=>(b[1]?.z||0)-(a[1]?.z||0))[0];if(existing){focusWindow(existing[0])}else{const a=APPS.find(x=>x.name===taskbarMenu.name);if(a)openApp(a)}setTaskbarMenu(null)}} onClose={()=>{const k=taskbarMenu.key||taskbarMenu.name;if(windows[k])closeWindow(k);setTaskbarMenu(null)}}/>} 
      {desktop && languagePrompt && <LanguageRestartDialog language={languagePrompt} onCancel={()=>setLanguagePrompt(null)} onRestart={applyLanguageAndRestart}/>} 
      {desktop && renaming && <RenameDialog value={renaming.name} onChange={name=>setRenaming({...renaming,name})} onCancel={()=>setRenaming(null)} onSave={()=>renameItem(renaming.type,renaming.id,renaming.name)}/>} 

    
      {badTimeWarning && <div role="dialog" aria-modal="true" aria-labelledby="bad-time-warning-title" style={{position:'fixed',inset:0,zIndex:999999,display:'grid',placeItems:'center',padding:20,background:'rgba(0,0,0,.78)'}}>
        <section style={{width:'min(440px,100%)',padding:26,borderRadius:18,background:'linear-gradient(145deg,#171923,#0d0f16)',border:'1px solid #484b59',boxShadow:'0 24px 90px #0009',color:'#f8fafc',fontFamily:'inherit'}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}><img src="/IDA-OS/Sans-Blaster2.png" alt="" style={{width:66,height:66,objectFit:'contain',imageRendering:'pixelated',borderRadius:12,background:'#050505'}}/><div><div style={{fontSize:11,letterSpacing:2,color:'#f87171',fontWeight:800}}>WARNING</div><h2 id="bad-time-warning-title" style={{fontSize:24,margin:'4px 0 0'}}>Bad-Time</h2></div></div>
          <p style={{fontSize:16,lineHeight:1.55,color:'#e5e7eb',margin:'0 0 22px'}}>This game will rage-bait you. Are you sure you want to continue?</p>
          <label style={{display:'flex',alignItems:'center',gap:9,fontSize:13,color:'#cbd5e1',marginBottom:22,cursor:'pointer'}}><input type="checkbox" checked={dontAskBadTime} onChange={e=>setDontAskBadTime(e.target.checked)} style={{width:16,height:16,accentColor:'#38bdf8'}}/> Don't ask me again</label>
          <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
            <button onClick={()=>setBadTimeWarning(null)} style={{padding:'10px 17px',borderRadius:10,border:'1px solid #4b5563',background:'#242733',color:'#f8fafc',fontWeight:650,cursor:'pointer'}}>No, close</button>
            <button onClick={()=>{if(dontAskBadTime){try{localStorage.setItem('ida-bad-time-dont-ask','1')}catch{}}const desktopInstance=badTimeWarning.desktopInstance;setBadTimeWarning(null);const app=APPS.find(a=>a.name==='Bad-Time');if(app){const k=(desktopInstance?'desktop:':'taskbar:')+'Bad-Time:'+Date.now();setWindows(prev=>{const maxZ=Math.max(0,...Object.values(prev).map((w:any)=>Number(w?.z)||0));return {...prev,[k]:{kind:'sans',appName:'Bad-Time',minimized:false,maximized:false,x:35,y:30,width:Math.min(window.innerWidth-40,1050),height:Math.min(window.innerHeight-90,720),z:maxZ+1,taskbarInstance:!desktopInstance,appInstanceId:'Bad-Time'}}});setActiveWindow(k)}}} style={{padding:'10px 17px',borderRadius:10,border:0,background:'#e5e7eb',color:'#111827',fontWeight:750,cursor:'pointer'}}>Yes, I'm ready</button>
          </div>
        </section>
      </div>}
</main>
  )
}

function AppTile({ app, displayName, shortcutId, position, editMode, onEdit, onOpen, onMove, onDropTarget, onContext, scale, selected, onSelect }: {
  app: AppItem; displayName:string; shortcutId?:string; position: Position; editMode: boolean; onEdit: () => void; onOpen: () => void; onMove: (p: Position) => void; onDropTarget:(target:string)=>void; onContext:(x:number,y:number)=>void; scale:number; selected:boolean; onSelect:()=>void
}) {
  const tileRef = useRef<HTMLButtonElement>(null)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const startPoint = useRef({ x: 0, y: 0 })
  const ghostRef = useRef<HTMLElement|null>(null)
  const [dragPos,setDragPos] = useState<Position|null>(null)
  const clearGhost = () => { ghostRef.current?.remove(); ghostRef.current=null; document.body.style.cursor='' }

  const pointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    clearGhost()
    if (e.button === 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    startPoint.current = { x:e.clientX, y:e.clientY }
    dragging.current = false
  }

  const pointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.buttons !== 1) return
    if (!dragging.current && (Math.abs(e.clientX-startPoint.current.x)>8 || Math.abs(e.clientY-startPoint.current.y)>8)) {
      dragging.current = true
      onEdit()
      tileRef.current?.setPointerCapture(e.pointerId)
      if (tileRef.current) {
        tileRef.current.style.cursor = 'grabbing'
        tileRef.current.style.opacity = '.22'
        const g=tileRef.current.cloneNode(true) as HTMLElement
        const r=tileRef.current.getBoundingClientRect()
        g.classList.add('ida-drag-ghost'); g.style.position='fixed'; g.style.left='0'; g.style.top='0'; g.style.width=r.width+'px'; g.style.height=r.height+'px'; g.style.margin='0'; g.style.pointerEvents='none'; g.style.zIndex='2147483647'; g.style.opacity='.58'
        document.body.appendChild(g); ghostRef.current=g
      }
    }
    if (!dragging.current || !tileRef.current) return
    const tile = tileRef.current
    const parent = tile.parentElement?.getBoundingClientRect()
    if (!parent) return
    const maxX = Math.max(0, parent.width - tile.offsetWidth)
    const maxY = Math.max(0, parent.height - tile.offsetHeight)
    const x = Math.min(maxX, Math.max(0, e.clientX - parent.left - offset.current.x))
    const y = Math.min(maxY, Math.max(0, e.clientY - parent.top - offset.current.y))
    setDragPos({ x: (x / parent.width) * 100, y: (y / parent.height) * 100 })
    if(ghostRef.current){
      ghostRef.current.style.transform=`translate3d(${e.clientX-offset.current.x}px,${e.clientY-offset.current.y}px,0)`
      const hit=(document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null)
      const folder=hit?.closest('[data-drop-folder]')
      const occupied=hit?.closest('.app-tile,.desktop-file-tile') && !folder
      ghostRef.current.classList.toggle('ida-drop-forbidden',!!occupied)
      document.body.style.cursor=occupied?'not-allowed':''
    }
  }

  const pointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button === 2) return
    const wasDragging = dragging.current
    dragging.current = false
    if (tileRef.current?.hasPointerCapture(e.pointerId)) tileRef.current.releasePointerCapture(e.pointerId)
    if (tileRef.current) { tileRef.current.style.cursor = editMode ? 'grab' : 'pointer'; tileRef.current.style.opacity='' }
    clearGhost()
    if (wasDragging) {
      const finalPos = dragPos
      const target=(document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null)?.closest('[data-drop-folder]')?.getAttribute('data-drop-folder')
      if(target) onDropTarget(target)
      else if(finalPos) onMove(finalPos)
      setDragPos(null)
    } else onSelect()
  }

  return (
    <button
      ref={tileRef}
      className={`app-tile ${selected ? 'app-tile-selected' : ''}`}
      style={{ left: `${(dragging.current ? position : (dragPos||position)).x}%`, top: `${(dragging.current ? position : (dragPos||position)).y}%`, ['--scale' as string]: scale }}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onClick={(e) => {
        if (dragging.current) return
        const now = Date.now()
        const last = (tileRef.current as any)?._idaLastClick || 0
        if (dragging.current) return
        ;(tileRef.current as any)._idaLastClick = Date.now()
      }}
      onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen() }}
      onPointerCancel={() => { dragging.current = false }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContext(e.clientX,e.clientY) }}
      aria-label={app.name}
      data-app-id={shortcutId||app.name}
    >
      <span className={`app-icon tone-${app.tone}`}>
        <IdaAppIcon name={app.name} size={38}/>
      </span>
      <span className="app-name">{displayName}</span>
    </button>
  )
}

function DappLogo({size=38}:{size?:number}){return <span className="dapp-logo" style={{width:size,height:size}}><span className="dapp-logo-core">D</span><span className="dapp-logo-orbit orbit-a"/><span className="dapp-logo-orbit orbit-b"/></span>}
function DaScopeLogo({size=38}:{size?:number}){return <span className="dascope-logo" style={{width:size,height:size}} aria-hidden="true"><Moon size={size*0.86} strokeWidth={2.35}/></span>}
function DaDriftPanel(){return <iframe title="DaDrift racing game" src={import.meta.env.BASE_URL+'DaDrift.html'} style={{display:'block',position:'absolute',inset:0,border:0,width:'100%',height:'100%',background:'#0b0d12'}}/>}

function DaDriftLogo({size=38}:{size?:number}){return <svg width={size} height={size} viewBox="0 0 64 64" aria-label="DaDrift drifting car logo" role="img" style={{display:'block',flexShrink:0}}><defs><linearGradient id="driftCarPaint" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f9fbff"/><stop offset="100%" stopColor="#9caec6"/></linearGradient></defs><path d="M5 43h18M2 49h16M8 55h14" stroke="#50c8ff" strokeWidth="3.5" strokeLinecap="round"/><g transform="rotate(-12 36 34)"><path d="M19 37l5-10c1-2 3-3 6-3h14c3 0 5 1 7 4l6 9 3 3v8H16v-7z" fill="url(#driftCarPaint)" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/><path d="M29 27h13c2 0 3 1 4 3l3 5H25l2-5c.5-2 1-3 2-3z" fill="#172638"/><path d="M20 39h35" stroke="#ff4b55" strokeWidth="3"/><path d="M19 43h-3v4h6M52 43h6v4h-6" fill="#f8fafc"/><circle cx="25" cy="48" r="5.5" fill="#111722" stroke="#dbe4ef" strokeWidth="2"/><circle cx="49" cy="48" r="5.5" fill="#111722" stroke="#dbe4ef" strokeWidth="2"/><circle cx="25" cy="48" r="2" fill="#6f829a"/><circle cx="49" cy="48" r="2" fill="#6f829a"/></g></svg>}
function DaTVLogo({size=38}:{size?:number}){return <span style={{width:size,height:size,borderRadius:size*.22,background:'linear-gradient(145deg,#ff424d,#b80e22)',display:'inline-flex',alignItems:'center',justifyContent:'center',color:'#fff',flexShrink:0,boxShadow:'inset 0 1px 0 #ffffff55,0 3px 10px #c9152a35',position:'relative'}} aria-label="DaTV television logo"><Tv size={size*.72} strokeWidth={2.9}/></span>}
type DaSearchHit={title:string;url:string;snippet:string};
function parseDaSearchResults(body:string,youtubeOnly=false):DaSearchHit[]{const found:DaSearchHit[]=[];const seen=new Set<string>();const add=(title:string,url:string,snippet='')=>{let clean=url.trim();while('),.;'.includes(clean.slice(-1)))clean=clean.slice(0,-1);try{const u=new URL(clean);if(u.protocol!=='https:'&&u.protocol!=='http:')return;if(youtubeOnly&&!(/(^|\.)youtube\.com$/i.test(u.hostname)||u.hostname==='youtu.be'))return;if(clean.includes('s.jina.ai')||seen.has(clean))return}catch{return}seen.add(clean);found.push({title:title.replace(/\*\*/g,'').trim()||clean,url:clean,snippet:snippet.trim().slice(0,240)})};try{const parsed=JSON.parse(body);const rows=Array.isArray(parsed)?parsed:(Array.isArray(parsed.data)?parsed.data:[]);for(const row of rows){if(row&&typeof row.url==='string')add(String(row.title||row.name||row.url),row.url,String(row.description||row.content||''))}}catch{}for(const m of body.matchAll(/Title:\s*([^\n]+)\s*\nURL Source:\s*(https?:\/\/[^\s]+)(?:\s*\n(?:Published Time|Markdown Content):\s*([^\n]+))?/g))add(m[1],m[2],m[3]||'');for(const m of body.matchAll(/\[([^\]]{2,180})\]\((https?:\/\/[^)\s]+)\)/g))add(m[1],m[2]);return found.slice(0,12)}
function DaTVPanel({offline=false,volume=70,onDownloadVideo}:{offline?:boolean;volume?:number;onDownloadVideo?:(file:{name:string;mime:string;blob:Blob})=>Promise<void>|void}){
  type SavedVideo={id:string;title:string;url:string;embedUrl:string;savedAt:number};
  const [query,setQuery]=useState('');const [videoUrl,setVideoUrl]=useState('');const [hits,setHits]=useState<DaSearchHit[]>([]);const [viewUrl,setViewUrl]=useState('');const [originalUrl,setOriginalUrl]=useState('');const [loading,setLoading]=useState(false);const [downloading,setDownloading]=useState(false);const [notice,setNotice]=useState('');const importInputRef=useRef<HTMLInputElement|null>(null);const [history,setHistory]=useState<string[]>([]);const [saved,setSaved]=useState<SavedVideo[]>(()=>{try{return JSON.parse(localStorage.getItem('ida-datv-library-v1')||'[]')}catch{return []}});
  useEffect(()=>{try{localStorage.setItem('ida-datv-library-v1',JSON.stringify(saved))}catch{}},[saved]);
  const playerRef=useRef<HTMLIFrameElement|null>(null);
  const sendPlayerVolume=()=>{const frame=playerRef.current;if(!frame?.contentWindow)return;try{frame.contentWindow.postMessage(JSON.stringify({event:'command',func:'setVolume',args:[Math.max(0,Math.min(100,volume))]}),'https://www.youtube.com')}catch{}}
  useEffect(()=>{if(!viewUrl||!getVideoId(originalUrl||viewUrl))return;const timers=[0,250,700,1400].map(delay=>window.setTimeout(sendPlayerVolume,delay));return()=>timers.forEach(timer=>window.clearTimeout(timer))},[volume,viewUrl,originalUrl]);
  const getVideoId=(raw:string)=>{try{const u=new URL(raw.trim());const host=u.hostname.toLowerCase().replace(/^www\./,'');if(host==='youtu.be')return u.pathname.split('/').filter(Boolean)[0]||null;if(host==='youtube.com'||host==='m.youtube.com'||host==='music.youtube.com'||host==='youtube-nocookie.com'){if(u.pathname==='/watch')return u.searchParams.get('v');const parts=u.pathname.split('/').filter(Boolean);if(['embed','shorts','live'].includes(parts[0]))return parts[1]||null}}catch{}return null};
  const toEmbed=(raw:string)=>{try{const u=new URL(raw.trim());const id=getVideoId(raw);if(id){const params=new URLSearchParams();params.set('playsinline','1');params.set('rel','0');params.set('enablejsapi','1');params.set('origin',window.location.origin);return 'https://www.youtube.com/embed/'+encodeURIComponent(id)+'?'+params.toString()}if(u.protocol==='https:'||u.protocol==='http:')return u.href}catch{}return ''};
  const openVideo=(raw:string,title?:string)=>{const url=toEmbed(raw);if(!url){setNotice('Paste a valid YouTube or video URL first.');return}setHistory(prev=>viewUrl?[...prev,viewUrl]:prev);setOriginalUrl(raw);setViewUrl(url);setNotice('')};
  const search=async(e?:React.FormEvent)=>{e?.preventDefault();const q=query.trim();if(!q)return;setLoading(true);setNotice('');setHits([]);setViewUrl('');setHistory([]);try{const res=await fetch('https://r.jina.ai/https://www.youtube.com/results?search_query='+encodeURIComponent(q),{headers:{Accept:'text/plain'}});if(!res.ok)throw new Error('Search unavailable');const body=await res.text();const found=parseDaSearchResults(body,true);if(!found.length)throw new Error('No results parsed');setHits(found)}catch{setNotice('Could not load YouTube search results. Try again, or paste a video URL.')}finally{setLoading(false)}};
  const saveVideo=(raw:string,title?:string)=>{const embedUrl=toEmbed(raw);if(!embedUrl){setNotice('That does not look like a valid video link.');return}const id=getVideoId(raw);const cleanTitle=(title||'Saved video').trim().slice(0,120);setSaved(prev=>prev.some(v=>v.url===raw||v.embedUrl===embedUrl)?prev:[{id:crypto.randomUUID(),title:cleanTitle,url:raw,embedUrl,savedAt:Date.now()},...prev].slice(0,100));setNotice('Saved to your DaTV library on this browser.')};
  const importVideoFile=async(file:File)=>{if(!file.type.startsWith('video/')&&!/\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(file.name)){setNotice('Choose a video file such as MP4 or WebM.');return}if(!onDownloadVideo){setNotice('IDA video storage is unavailable.');return}setDownloading(true);setNotice('Saving video into IDA Videos…');try{const mime=file.type||(/\.webm$/i.test(file.name)?'video/webm':/\.(ogv|ogg)$/i.test(file.name)?'video/ogg':/\.mov$/i.test(file.name)?'video/quicktime':'video/mp4');await onDownloadVideo({name:file.name,mime,blob:file});setNotice('Video saved into IDA Videos. Open it there to play in DaMedia.')}catch{setNotice('Could not save the video to IDA storage. Please try again.')}finally{setDownloading(false)}}
  const isDirectDownload=/\.(mp4|webm|ogv|ogg|mov|m4v)(?:[?#]|$)/i.test(originalUrl||viewUrl);
  const downloadVideo=async()=>{const raw=(originalUrl||viewUrl).trim();if(!raw)return;if(getVideoId(raw)){setNotice('DaTV cannot download YouTube streams as standalone files. For videos you own, download the original through YouTube Studio, then import that file into IDA Videos.');return}setDownloading(true);setNotice('Downloading the actual video into IDA Videos…');try{const response=await fetch(raw);if(!response.ok)throw new Error('Download failed');const blob=await response.blob();if(!blob.size)throw new Error('The video file was empty');const path=new URL(raw).pathname;let name='Downloaded video';try{name=decodeURIComponent(path.split('/').filter(Boolean).pop()||name)}catch{}if(!/\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(name)){const ext=blob.type==='video/webm'?'.webm':blob.type==='video/ogg'?'.ogv':blob.type==='video/quicktime'?'.mov':'.mp4';name+=ext}const mime=blob.type&&blob.type.startsWith('video/')?blob.type:(/\.webm$/i.test(name)?'video/webm':/\.(ogv|ogg)$/i.test(name)?'video/ogg':/\.mov$/i.test(name)?'video/quicktime':'video/mp4');if(!blob.type.startsWith('video/')&&!isDirectDownload)throw new Error('This URL did not return a video file');if(!onDownloadVideo)throw new Error('IDA file storage is unavailable');await onDownloadVideo({name,mime,blob});setNotice('Downloaded the actual video into IDA Videos. Open the file there to play it in DaMedia.')}catch{setNotice('Could not save this URL as a video. The server may block browser downloads (CORS), or the link may not be a direct video file. You can import a video file you already have into IDA Videos.')}finally{setDownloading(false)}};
  if(offline)return <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10,background:'#11151d',color:'#fff',textAlign:'center'}}><Wifi size={42} opacity={.75}/><strong style={{fontSize:22}}>Waiting for Wi-Fi connection</strong><span style={{opacity:.65}}>Connect to Wi-Fi to use DaTV.</span></div>;
  return <div style={{height:'100%',minHeight:0,display:'flex',flexDirection:'column',background:'#10131a',color:'#fff',padding:16,boxSizing:'border-box',gap:12,overflow:'auto'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>{viewUrl&&<button onClick={()=>{setViewUrl(history[history.length-1]||'');setHistory(prev=>prev.slice(0,-1));setNotice('')}} title="Back" style={{padding:'8px 12px',borderRadius:9,border:'1px solid #343b49',background:'#1b202b',color:'#fff',cursor:'pointer'}}>← Back</button>}<DaTVLogo size={40}/><div style={{flex:1}}><h2 style={{margin:0}}>DaTV</h2><span style={{opacity:.65,fontSize:13}}>Watch and save videos inside IDA</span></div>{viewUrl&&<button onClick={()=>saveVideo(originalUrl||viewUrl,query||'Saved video')} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #454d5d',background:'#252b38',color:'#fff',cursor:'pointer'}}>＋ Save to library</button>}{viewUrl&&!getVideoId(originalUrl||viewUrl)&&<button onClick={downloadVideo} disabled={downloading} style={{padding:'9px 12px',borderRadius:9,border:0,background:'#2878ed',color:'#fff',cursor:downloading?'wait':'pointer',opacity:downloading ? .7 : 1}}>{downloading?'Downloading…':'Download to IDA Videos'}</button>}
      {viewUrl&&getVideoId(originalUrl||viewUrl)&&<span style={{fontSize:12,opacity:.7}}>YouTube links can be saved to the DaTV library; standalone downloads are available for direct video files.</span>}<button onClick={()=>importInputRef.current?.click()} disabled={downloading} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #454d5d',background:'#252b38',color:'#fff',cursor:downloading?'wait':'pointer'}}>{downloading?'Saving…':'Import video file'}</button><input ref={importInputRef} type="file" accept="video/*,.mp4,.webm,.ogv,.ogg,.mov,.m4v" style={{display:'none'}} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importVideoFile(file)}} /></div>
    <form onSubmit={search} style={{display:'flex',gap:8,flexWrap:'wrap'}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search YouTube…" style={{flex:'1 1 220px',minWidth:0,padding:'11px 13px',borderRadius:10,border:'1px solid #343b49',background:'#1b202b',color:'#fff'}}/><button type="submit" style={{padding:'11px 18px',borderRadius:9,border:0,background:'#f12636',color:'#fff',fontWeight:600,cursor:'pointer'}}>{loading?'Searching…':'Search'}</button></form>
    <form onSubmit={e=>{e.preventDefault();openVideo(videoUrl,query)}} style={{display:'flex',gap:8}}><input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="Paste a YouTube or direct video URL…" style={{flex:1,minWidth:0,padding:'10px 12px',borderRadius:9,border:'1px solid #343b49',background:'#1b202b',color:'#fff'}}/><button type="submit" style={{padding:'10px 14px',borderRadius:8,border:'1px solid #454d5d',background:'#252b38',color:'#fff',cursor:'pointer'}}>Play</button></form>
    {notice&&<div style={{fontSize:13,color:'#b9d8ff'}}>{notice}</div>}
    {viewUrl?<div style={{flex:1,minHeight:320,display:'flex',flexDirection:'column',gap:8}}><div style={{fontSize:12,opacity:.7,overflowWrap:'anywhere'}}>{originalUrl||viewUrl}</div>{isDirectDownload?<video key={viewUrl} src={originalUrl||viewUrl} controls playsInline style={{width:'100%',maxHeight:'70vh',minHeight:320,borderRadius:10,background:'#000'}}/>:<iframe key={viewUrl} ref={playerRef} onLoad={()=>{sendPlayerVolume();window.setTimeout(sendPlayerVolume,350)}} title="DaTV video player" src={viewUrl} referrerPolicy="strict-origin-when-cross-origin" style={{flex:1,minHeight:320,width:'100%',border:0,borderRadius:10,background:'#000'}} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>}</div>:<div style={{flex:1,minHeight:180,overflowY:'auto',display:'flex',flexDirection:'column',gap:12}}>
      {hits.length>0&&<section><strong style={{display:'block',marginBottom:8}}>YouTube results</strong><div style={{display:'flex',flexDirection:'column',gap:8}}>{hits.map((h,i)=><div key={h.url+i} style={{display:'flex',gap:8,alignItems:'stretch',padding:12,borderRadius:10,border:'1px solid #343b49',background:'#1b202b'}}><button onClick={()=>openVideo(h.url,h.title)} style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',alignItems:'flex-start',gap:5,border:0,background:'transparent',color:'#fff',textAlign:'left',cursor:'pointer'}}><strong>{h.title}</strong><span style={{fontSize:12,opacity:.7,overflowWrap:'anywhere'}}>{h.url}</span>{h.snippet&&<span style={{fontSize:12,opacity:.75}}>{h.snippet}</span>}</button><button onClick={()=>saveVideo(h.url,h.title)} style={{alignSelf:'center',padding:'8px 10px',borderRadius:8,border:'1px solid #454d5d',background:'#252b38',color:'#fff',cursor:'pointer'}}>Save</button></div>)}</div></section>}
      <section><strong style={{display:'block',marginBottom:8}}>Saved videos · {saved.length}</strong>{saved.length?<div style={{display:'flex',flexDirection:'column',gap:7}}>{saved.map(v=><div key={v.id} style={{display:'flex',alignItems:'center',gap:8,padding:10,borderRadius:10,border:'1px solid #343b49',background:'#1b202b'}}><button onClick={()=>{setOriginalUrl(v.url);setViewUrl(v.embedUrl);setHistory([]);setNotice('')}} style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',alignItems:'flex-start',gap:4,border:0,background:'transparent',color:'#fff',cursor:'pointer',textAlign:'left'}}><strong>{v.title}</strong><span style={{fontSize:11,opacity:.6,overflowWrap:'anywhere'}}>{v.url}</span></button><button onClick={()=>setSaved(prev=>prev.filter(x=>x.id!==v.id))} title="Remove saved video" style={{padding:'7px 9px',borderRadius:8,border:'1px solid #454d5d',background:'#252b38',color:'#fff',cursor:'pointer'}}>×</button></div>)}</div>:<div style={{padding:14,borderRadius:10,background:'#171d28',opacity:.7,fontSize:13}}>Save a video link to keep it here for next time. Your library stays in this browser.</div>}</section>
      {!hits.length&&!saved.length&&!loading&&<div style={{textAlign:'center',opacity:.65,padding:14}}>Search YouTube, paste a video link, or save videos to your library.</div>}
    </div>}
    <small style={{opacity:.55}}>YouTube videos play through the official embedded player. Some videos block embedding; direct video-file URLs can be downloaded. YouTube video downloads are not available here.</small>
  </div>
}
function DaScopeSearch({offline=false}:{offline?:boolean}){
  const [query,setQuery]=useState('');const [answer,setAnswer]=useState('');const [sources,setSources]=useState<DaSearchHit[]>([]);const [images,setImages]=useState<{title:string;url:string;thumb:string;source:string}[]>([]);const [loading,setLoading]=useState(false);const [notice,setNotice]=useState('');const [history,setHistory]=useState<{query:string;answer:string;sources:DaSearchHit[];images:{title:string;url:string;thumb:string;source:string}[]}[]>([]);
  const ask=async(e?:React.FormEvent)=>{e?.preventDefault();const q=query.trim();if(!q||loading)return;setLoading(true);setNotice('');setAnswer('');setSources([]);setImages([]);try{const res=await fetch('https://roxnnwrmgbxnhmwjolep.supabase.co/functions/v1/dascope-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':'sb_publishable_-x-g50GLtgo3Ut9fcNbStA_OUz4eBjw'},body:JSON.stringify({query:q})});const data=await res.json();if(!res.ok)throw new Error(data.error||'DaScope could not get an answer.');const foundSources=Array.isArray(data.sources)?data.sources:[];const foundImages=Array.isArray(data.images)?data.images:[];setAnswer(data.answer||'No answer returned.');setSources(foundSources);setImages(foundImages);setHistory(prev=>[{query:q,answer:data.answer||'',sources:foundSources,images:foundImages},...prev].slice(0,8))}catch(err){setNotice(err instanceof Error?err.message:'Could not reach DaScope. Try again.')}finally{setLoading(false)}};
  if(offline)return <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10,background:'#11151d',color:'#fff',textAlign:'center'}}><Wifi size={42} opacity={.75}/><strong style={{fontSize:22}}>Waiting for Wi-Fi connection</strong><span style={{opacity:.65}}>Connect to Wi-Fi to use DaScope.</span></div>;
  return <div style={{height:'100%',minHeight:0,display:'flex',flexDirection:'column',background:'#10141d',color:'#fff',padding:16,boxSizing:'border-box',gap:12,overflow:'auto'}}>
    <div style={{display:'flex',alignItems:'center',gap:10}}><DaScopeLogo size={44}/><div><strong style={{fontSize:20}}>DaScope AI</strong><div style={{fontSize:12,opacity:.65}}>Ask anything · web sources · images</div></div></div>
    <form onSubmit={ask} style={{display:'flex',gap:8}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ask DaScope anything…" style={{flex:1,minWidth:0,padding:'13px 14px',borderRadius:11,border:'1px solid #343b49',background:'#1b202b',color:'#fff'}}/><button type="submit" disabled={loading||!query.trim()} style={{padding:'10px 16px',borderRadius:10,border:0,background:loading?'#465268':'#2878ed',color:'#fff',cursor:loading?'wait':'pointer',fontWeight:600}}>{loading?'Thinking…':'Ask'}</button></form>
    {notice&&<div style={{padding:12,borderRadius:10,background:'#39251d',color:'#ffd1b0',fontSize:13}}>{notice}</div>}{loading&&<div style={{padding:20,textAlign:'center',opacity:.75}}>Searching the web and preparing an answer…</div>}
    {answer&&<section style={{padding:16,border:'1px solid #30394a',borderRadius:13,background:'#171d28'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><Sparkles size={18} color="#7eb3ff"/><strong>Answer</strong></div><div style={{whiteSpace:'pre-wrap',lineHeight:1.65,fontSize:14}}>{answer}</div></section>}
    {sources.length>0&&<section><strong style={{display:'block',marginBottom:9}}>Sources from the internet</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8}}>{sources.map((h,i)=><a key={h.url+i} href={h.url} target="_blank" rel="noreferrer" style={{display:'flex',flexDirection:'column',gap:6,padding:12,borderRadius:10,border:'1px solid #343b49',background:'#1b202b',color:'#fff',textDecoration:'none'}}><strong style={{fontSize:13}}>{h.title}</strong><span style={{fontSize:11,color:'#8bbcff',overflowWrap:'anywhere'}}>{h.url}</span>{h.snippet&&<span style={{fontSize:12,opacity:.75,lineHeight:1.4}}>{h.snippet}</span>}</a>)}</div></section>}
    {images.length>0&&<section><strong style={{display:'block',marginBottom:9}}>Images</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(135px,1fr))',gap:10}}>{images.map((im,i)=><a key={im.url+i} href={im.url} target="_blank" rel="noreferrer" title={im.title} style={{display:'flex',flexDirection:'column',gap:6,color:'#fff',textDecoration:'none',fontSize:12}}><img src={im.thumb||im.url} alt={im.title} loading="lazy" style={{width:'100%',height:125,objectFit:'cover',borderRadius:9,background:'#202632'}}/><span>{im.title}</span><span style={{fontSize:10,opacity:.55}}>{im.source}</span></a>)}</div></section>}
    {!answer&&!loading&&!notice&&<div style={{flex:1,minHeight:180,display:'grid',placeItems:'center',textAlign:'center',opacity:.65}}><div><Sparkles size={40}/><p style={{fontSize:15}}>Your AI search starts here.</p><small>Answers, useful web pages, and relevant images in one place.</small></div></div>}
    {history.length>1&&<section><strong style={{display:'block',marginBottom:8}}>Recent questions</strong><div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{history.slice(1).map((item,i)=><button key={item.query+i} onClick={()=>{setQuery(item.query);setAnswer(item.answer);setSources(item.sources);setImages(item.images);setNotice('')}} style={{padding:'7px 10px',borderRadius:9,border:'1px solid #343b49',background:'#1b202b',color:'#fff',cursor:'pointer',maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.query}</button>)}</div></section>}
  </div>
}
function BadTimeLogo({size=28}:{size?:number}){return <svg width={size} height={size} viewBox="9 9 110 110" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Bad-Time skull icon" style={{display:'block',flexShrink:0}}><defs><linearGradient id="badTimeBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#171923"/><stop offset="1" stopColor="#050609"/></linearGradient><filter id="badTimeGlow"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect x="3" y="3" width="122" height="122" rx="25" fill="url(#badTimeBg)" stroke="#3b4252" strokeWidth="3"/><path d="M26 38 38 23 48 31 62 25 77 31 89 23 102 40 98 70 89 83 87 103 74 103 68 90 58 90 52 103 39 103 37 82 27 68Z" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2.5" strokeLinejoin="round"/><path d="M35 47 53 47 48 58 35 58Z" fill="#050609"/><path d="M72 45 94 45 88 59 72 59Z" fill="#050609"/><path d="M70 45 94 45 88 59 72 59Z" fill="#38bdf8" filter="url(#badTimeGlow)"/><path d="M79 43 88 43 84 60 76 60Z" fill="#e0f2fe"/><path d="M44 70 52 70 52 78 60 78 60 70 68 70 68 78 76 78 76 70 84 70 84 82 76 82 76 88 52 88 52 82 44 82Z" fill="#111827"/><path d="M24 99 36 93 43 100 36 108 24 107Z" fill="#ef4444"/><path d="M104 99 92 93 85 100 92 108 104 107Z" fill="#ef4444"/><path d="M17 64h9M102 64h9" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/></svg>}
function IdaAppIcon({name,size=28}:{name:string;size?:number}){return name==='DAPP'?<DappLogo size={size}/>:name==='DaScope'?<DaScopeLogo size={size}/>:name==='DaEconomy'?<BankIcon size={size}/>:name==='DaCourt'?<Scale size={size}/>:name==='DaMusic'?<Music2 size={size}/>:name==='DaFile Explorer'?<Folder size={size}/>:name==='DaNotes'?<FileText size={size}/>:name==='Da C++ Studio'?<Code2 size={size} color="#a5b4fc"/>:name==='DaWord'?<FilePlus2 size={size} color="#60a5fa"/>:name==='DaExcellent'?<Sigma size={size} color="#4ade80"/>:name==='DaPower'?<FileText size={size} color="#fb923c"/>:name==='DaTrash'?<Trash2 size={size}/>:name==='DaSettings'?<Gear size={size}/> :name==='DaMedia'?<Film size={size}/>:name==='DaTV'?<DaTVLogo size={size}/>:name==='DaDrift'?<DaDriftLogo size={size}/>:name==='Bad-Time'?<BadTimeLogo size={size*1.28}/>:name==='Daculator'?<Calculator size={size} color="#6ee7b7" strokeWidth={2.4}/>:name==='DaRaw'?<span className="daraw-app-logo" style={{width:size,height:size,fontSize:size*.82}}>🖌️</span>:<Folder size={size}/>} 

function DappStore({internetOn,installed,onInstall,onUninstall,onOpen}:{internetOn:boolean;installed:(name:string)=>boolean;onInstall:(name:string)=>void;onUninstall:(name:string)=>void;onOpen:(name:string)=>void}){
  const [query,setQuery]=useState(''); const [selected,setSelected]=useState<DappCatalogItem|null>(null); const [installing,setInstalling]=useState<string|null>(null); const [uninstalling,setUninstalling]=useState<string|null>(null); const [progress,setProgress]=useState(0); const [confirm,setConfirm]=useState<string|null>(null); const [voterId,setVoterId]=useState('')
  const [ratings,setRatings]=useState<Record<string,Array<{voterId:string;rating:number}>>>({}); const [ratingNotice,setRatingNotice]=useState('')
  const results=DAPP_CATALOG.filter(a=>(a.name+' '+a.description+' '+a.category).toLowerCase().includes(query.toLowerCase()))
  const readRatingSession=()=>{try{const raw=localStorage.getItem('ida-account-session-v1');const s=raw?JSON.parse(raw):null;return s?.accountId&&s?.sessionToken?{accountId:String(s.accountId),sessionToken:String(s.sessionToken)}:null}catch{return null}}
  const guestVoterId=()=>{try{let id=localStorage.getItem('ida-dapp-rating-guest-v1');if(!id){id='guest-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);localStorage.setItem('ida-dapp-rating-guest-v1',id)}return id}catch{return 'guest-local'}}; const readLocalRatings=()=>{try{const v=JSON.parse(localStorage.getItem('ida-dapp-local-ratings-v1')||'{}');return v&&typeof v==='object'?v as Record<string,number>:{}}catch{return {}}}; const loadSharedRatings=async()=>{const session=readRatingSession(),guest=guestVoterId();setVoterId(session?.accountId||guest);const local=readLocalRatings();try{const response=await fetch('https://roxnnwrmgbxnhmwjolep.supabase.co/rest/v1/rpc/ida_get_dapp_ratings',{method:'POST',headers:{'Content-Type':'application/json','apikey':'sb_publishable_-x-g50GLtgo3Ut9fcNbStA_OUz4eBjw'},body:JSON.stringify({p_account_id:session?.accountId||null,p_session_token:session?.sessionToken||null})});if(!response.ok)throw new Error('Remote ratings unavailable');const data=await response.json();const merged:Record<string,Array<{voterId:string;rating:number}>>={};Object.entries(data||{}).forEach(([name,value]:[string,any])=>{const votes=Array.isArray(value?.votes)?value.votes:[];merged[name]=votes.map((vote:any,index:number)=>({voterId:vote?.isMine&&session?session.accountId:'shared-vote-'+name+'-'+index,rating:Number(vote?.rating)})).filter(v=>Number.isInteger(v.rating)&&v.rating>=1&&v.rating<=5)});Object.entries(local).forEach(([name,rating])=>{if(Number.isInteger(rating)&&rating>=1&&rating<=5){const votes=merged[name]||[];const index=votes.findIndex(v=>v.voterId===guest);if(index>=0)votes[index]={voterId:guest,rating};else votes.push({voterId:guest,rating});merged[name]=votes}});setRatings(merged);setRatingNotice('')}catch{const localOnly:Record<string,Array<{voterId:string;rating:number}>>={};Object.entries(local).forEach(([name,rating])=>{if(Number.isInteger(rating)&&rating>=1&&rating<=5)localOnly[name]=[{voterId:guest,rating}]});setRatings(localOnly);setRatingNotice('Showing ratings saved on this device; shared ratings are temporarily unavailable.')}}
  const appRatings:Array<{voterId:string;rating:number}>=(selected&&Array.isArray(ratings[selected.name])?ratings[selected.name]:[])
  const total=appRatings.length
  const average=total?appRatings.reduce((sum,v)=>sum+v.rating,0)/total:0
  const breakdown={one:appRatings.filter(v=>v.rating===1).length,two:appRatings.filter(v=>v.rating===2).length,three:appRatings.filter(v=>v.rating===3).length,four:appRatings.filter(v=>v.rating===4).length,five:appRatings.filter(v=>v.rating===5).length}
  const myRating=selected&&voterId?(appRatings.find(v=>v.voterId===voterId)?.rating||0):0
  useEffect(()=>{let active=true;const refresh=()=>{if(active)void loadSharedRatings()};refresh();const onVisible=()=>{if(document.visibilityState==='visible')refresh()};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',onVisible);window.addEventListener('ida-account-session-changed',refresh);const timer=window.setInterval(()=>{if(document.visibilityState==='visible')refresh()},10000);return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('ida-account-session-changed',refresh)}},[])
  const startInstall=(name:string)=>{if(installing||uninstalling||!internetOn)return;setInstalling(name);setProgress(0);let p=0;const timer=window.setInterval(()=>{p=Math.min(100,p+Math.floor(Math.random()*13)+5);setProgress(p);if(p>=100){window.clearInterval(timer);setInstalling(null);setProgress(0);onInstall(name)}},180)}
  const startUninstall=(name:string)=>{if(uninstalling||installing)return;setConfirm(null);setUninstalling(name);setProgress(0);let p=0;const timer=window.setInterval(()=>{p=Math.min(100,p+Math.floor(Math.random()*10)+7);setProgress(p);if(p>=100){window.clearInterval(timer);setUninstalling(null);setProgress(0);onUninstall(name)}},120)}
  const submitRating=async(name:string,n:number)=>{if(!internetOn||!Number.isInteger(n)||n<1||n>5)return;const session=readRatingSession(),guest=guestVoterId();if(!session){const local=readLocalRatings();local[name]=n;try{localStorage.setItem('ida-dapp-local-ratings-v1',JSON.stringify(local))}catch{}setVoterId(guest);setRatings(old=>({...old,[name]:[...(old[name]||[]).filter(v=>v.voterId!==guest),{voterId:guest,rating:n}]}));setRatingNotice('Saved on this device. Sign in to share your rating.');return}try{const response=await fetch('https://roxnnwrmgbxnhmwjolep.supabase.co/rest/v1/rpc/ida_submit_dapp_rating',{method:'POST',headers:{'Content-Type':'application/json','apikey':'sb_publishable_-x-g50GLtgo3Ut9fcNbStA_OUz4eBjw'},body:JSON.stringify({p_account_id:session.accountId,p_session_token:session.sessionToken,p_app_name:name,p_rating:n})});if(!response.ok)throw new Error('Rating could not be saved');await loadSharedRatings();setRatingNotice('Rating saved.')}catch{const local=readLocalRatings();local[name]=n;try{localStorage.setItem('ida-dapp-local-ratings-v1',JSON.stringify(local))}catch{}setRatings(old=>({...old,[name]:[...(old[name]||[]).filter(v=>v.voterId!==guest),{voterId:guest,rating:n}]}));setRatingNotice('Could not sync right now; saved your rating on this device.')}}
  const icon=(name:string,size=34)=><span className={'dapp-icon-tone tone-'+(DAPP_CATALOG.find(x=>x.name===name)?.tone||'blue')}><IdaAppIcon name={name} size={size}/></span>
  return <div className="dapp-shell">{!internetOn?<div className="dapp-offline-screen"><DappLogo size={72}/><div className="dapp-offline-spinner"/><strong>Connection lost</strong><span>Turn on Wi‑Fi to reconnect to DAPP.</span><small>DAPP will keep waiting here until the connection returns.</small></div>:selected?<><div className="dapp-top"><button className="dapp-back" onClick={()=>setSelected(null)}>← <span>Back</span></button><div className="dapp-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search apps..."/></div></div><div className="dapp-detail"><div className="dapp-detail-hero"><div className="dapp-big-icon">{icon(selected.name,62)}</div><div className="dapp-detail-main"><h1>{selected.name}</h1><p className="dapp-tagline">{selected.tagline}</p><div className="dapp-meta"><span>{total?('★ '+average.toFixed(1)+' · '+total+' '+(total===1?'rating':'ratings')):'☆ No ratings yet'}</span><span>{selected.category}</span></div><div className="dapp-action">{installing===selected.name?<div className="dapp-installing"><div><strong>Installing...</strong><span>{progress}%</span></div><div className="dapp-progress"><i style={{width:progress+'%'}}/></div><small>Preparing {selected.name} for IDA</small></div>:uninstalling===selected.name?<div className="dapp-installing dapp-uninstalling"><div><strong>Uninstalling...</strong><span>{progress}%</span></div><div className="dapp-progress"><i style={{width:progress+'%'}}/></div><small>Removing {selected.name} from IDA...</small></div>:installed(selected.name)?<button className="dapp-uninstall" onClick={()=>setConfirm(selected.name)}>Uninstall</button>:<button className="dapp-install" disabled={!internetOn} onClick={()=>startInstall(selected.name)}><Download size={17}/> Install</button>}</div></div></div><section className="dapp-description"><h2>Description</h2><p>{selected.description}</p><h2>Ratings</h2><div className="dapp-rating-summary"><strong>{total?average.toFixed(1):'—'}</strong><div><div className="dapp-stars-static">{[1,2,3,4,5].map(n=><span key={n} className={average>=n-.25?'filled':''}>★</span>)}</div><small>{total?(total+' '+(total===1?'vote':'votes')):'No votes yet'}</small></div></div><div className="dapp-rating-breakdown">{([5,4,3,2,1] as const).map(n=>{const count=breakdown[['one','two','three','four','five'][n-1] as keyof typeof breakdown];const pct=total?count/total*100:0;return <div className="dapp-rating-row" key={n}><span>{n}</span><div><i style={{width:pct+'%'}}/></div><small>{count}</small></div>})}</div><h2 className="dapp-rate-title">Rate this app</h2><div className="dapp-stars">{[1,2,3,4,5].map(n=><button key={n} disabled={!internetOn||!voterId} className={n<=(myRating||0)?'active':''} onClick={()=>submitRating(selected.name,n)}>★</button>)}</div><small className="dapp-your-rating">{myRating?('Your rating: '+myRating+'/5'):'Choose a star to rate'}</small>{ratingNotice&&<small className="dapp-your-rating" role="status">{ratingNotice}</small>}</section></div>{confirm&&<div className="dapp-confirm"><div><strong>Uninstall {confirm}?</strong><p>This removes the app from the IDA desktop, folders, taskbar, open windows, and DaTrash. You can install it again from DAPP anytime.</p><button onClick={()=>setConfirm(null)}>Cancel</button><button className="danger" onClick={()=>startUninstall(confirm)}>Uninstall</button></div></div>}</>:<><div className="dapp-header"><div className="dapp-brand"><DappLogo size={46}/><div><strong>DAPP</strong><span>IDA App Store</span></div></div><div className="dapp-search dapp-search-wide"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search apps..."/></div></div><div className="dapp-content"><div className="dapp-heading"><div><span className="eyebrow">IDA</span><h1>Discover apps</h1><p>Install apps into IDA and keep them wherever you organize them.</p></div><span className="dapp-count">{results.length} apps</span></div><div className="dapp-grid">{results.map((a,i)=><button key={a.name} style={{animationDelay:(i*55)+'ms'}} className="dapp-card" onClick={()=>setSelected(a)}><div className="dapp-card-top"><div className="dapp-card-icon">{icon(a.name,40)}</div><div><strong>{a.name}</strong><small>{a.tagline}</small></div></div></button>)}</div></div></>}</div>
}

function BadTimeSimulatorPanel({offline=false}:{offline?:boolean}){if(offline)return <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10,background:'#11151d',color:'#fff',textAlign:'center'}}><Wifi size={42} opacity={.75}/><strong style={{fontSize:22}}>Waiting for Wi-Fi connection</strong><span style={{opacity:.65}}>Connect to Wi-Fi to play Bad-Time.</span></div>;return <div style={{position:'absolute',inset:0,overflow:'hidden',background:'#000'}}><iframe title="Bad-Time" src={import.meta.env.BASE_URL+'BadTime.html'} loading="eager" allow="autoplay; fullscreen; gamepad" allowFullScreen style={{position:'absolute',left:'-6%',top:'-6%',width:'112%',height:'112%',border:0,background:'#000',display:'block',contain:'strict',isolation:'isolate'}}/></div>}

function WebAppPanel({url,offline=false}:{url:string;offline?:boolean}){if(offline)return <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10,background:'#11151d',color:'#fff',textAlign:'center'}}><Wifi size={42} opacity={.75}/><strong style={{fontSize:22}}>Waiting for Wi-Fi connection</strong><span style={{opacity:.65}}>Connect to Wi-Fi to use this app.</span></div>;return <iframe src={url} title="IDA web app" className="webapp-frame" />}

type DaFileExplorerProps = {
  folder:string; setFolder:(folder:string)=>void; files:UserFile[]; folders:UserFolder[];
  folderApps:Record<string,string[]>; appLabels:Record<string,string>; apps:AppItem[]; desktopApps:string[];
  onImport:(list:FileList|null,location:string)=>void;
  onNewFile:(location?:string)=>void; onNewFolder:(location?:string)=>string; onNewNote:(location?:string)=>string;
  onMoveFile:(id:string,location:string)=>void; onMoveApp:(id:string,location:string)=>void;
  onEditFile:(id:string,data:string)=>void; explorerPositions:Record<string,number>; onExplorerMove:(id:string,y:number)=>void;
  onOpen:(file:UserFile)=>void; onOpenApp:(app:AppItem)=>void;
  onContext:(x:number,y:number,item:any)=>void; onCopy:(type:'app'|'file'|'folder',id:string)=>void;
  onCut:(type:'app'|'file'|'folder',id:string)=>void; onPaste:()=>void;
  onDelete:(type:'app'|'file'|'folder',id:string)=>void; onDeleteMany:(ids:string[])=>void; onAddDesktop:(id:string)=>void;
  openFileId:string|null; setOpenFileId:(id:string|null)=>void;
}
function DaFileExplorer({folder,setFolder,files,folders,folderApps,appLabels,apps,desktopApps,onImport,onNewFile,onNewFolder,onNewNote,onMoveFile,onMoveApp,onEditFile,explorerPositions,onExplorerMove,onOpen,onOpenApp,onContext,onCopy,onCut,onPaste,onDelete,onDeleteMany,onAddDesktop,openFileId,setOpenFileId}:DaFileExplorerProps) {
  const uploadRef=useRef<HTMLInputElement>(null);
  const [selected,setSelected]=useState<string|null>(null); const [selectedFiles,setSelectedFiles]=useState<string[]>([]);
  const [query,setQuery]=useState('');
  const [view,setView]=useState<'list'|'grid'>('list');
  const [dragged,setDragged]=useState<{type:'file'|'folder'|'app';id:string}|null>(null);
  const [notice,setNotice]=useState('');
  const roots=[['Home','Home'],['Recently saved','Recent'],['Desktop','Desktop'],['Documents','Documents'],['Photos','Pictures'],['Music','Music'],['Videos','Videos']] as const;
  const currentFolder=folders.find(item=>item.id===folder);
  const parentFolder=currentFolder?.parent||'Desktop';
  const isRoot=['Home','Recent','Desktop','Documents','Pictures','Music','Videos'].includes(folder);
  const folderFiles=files.filter(file=>file.location===folder);
  const folderFolders=folders.filter(item=>item.parent===folder);
  const visibleAppIds=folder==='Desktop'?desktopApps:(folderApps[folder]||[]);
  const visibleApps=visibleAppIds.map(id=>({id,app:appForId(id)})).filter((item):item is {id:string;app:AppItem}=>!!item.app);
  const term=query.trim().toLowerCase();
  const shownFiles=folder==='Home'?files:folder==='Recent'?[...files].sort((a,b)=>b.createdAt-a.createdAt).slice(0,30):folderFiles;
  const matches=(name:string)=>!term||name.toLowerCase().includes(term);
  const showFile=(file:UserFile)=>matches(file.name);
  const showFolder=(item:UserFolder)=>matches(item.name);
  const showApp=(item:{id:string;app:AppItem})=>matches(appLabels[item.id]||item.app.name);
  const moveTo=(type:'file'|'folder'|'app',id:string,target:string)=>{
    if(type==='app')onMoveApp(id,target);
    else onMoveFile(id,target);
    setDragged(null);
  };
  const rowStyle:React.CSSProperties={display:'flex',alignItems:'center',gap:12,minHeight:50,padding:'7px 12px',borderRadius:9,border:'1px solid transparent',color:'#e8edf5',textAlign:'left',background:'transparent',width:'100%',boxSizing:'border-box',cursor:'default'};
  const iconStyle:React.CSSProperties={width:34,height:34,display:'grid',placeItems:'center',borderRadius:9,background:'transparent',flexShrink:0};
  const openFolder=(item:UserFolder)=>setFolder(item.id);
  const downloadSavedFile=async(file:UserFile)=>{try{let blob:Blob;if(file.blobKey){const stored=await getVideoBlob(file.blobKey);if(!stored)throw new Error('File data is missing');blob=stored}else if(file.data?.startsWith('data:')){const response=await fetch(file.data);blob=await response.blob()}else blob=new Blob([file.data||''],{type:file.mime||'application/octet-stream'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);setNotice('Downloaded '+file.name)}catch{setNotice('Could not download '+file.name)}};
  const rootDestination=(target:string)=>target==='Home'?'Desktop':target;
  return <div className="explorer-shell" style={{height:'100%',minHeight:0,display:'flex',flexDirection:'column',color:'#20232a',background:'hsl(225 25% 10% / .9)',overflow:'hidden'}}>
    <div className="explorer-toolbar" style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:'1px solid hsl(var(--line))',background:'hsl(224 28% 8% / .97)',flexWrap:'wrap'}}>
      <button type="button" onClick={()=>setFolder(currentFolder?parentFolder:'Home')} disabled={folder==='Home'} title="Back" style={{border:0,borderRadius:8,padding:'8px 10px',background:'rgba(255,255,255,.07)',color:'inherit',cursor:'pointer'}}>←</button>
      <div style={{minWidth:100,flex:1,color:'#e8edf5'}}><div style={{fontSize:11,letterSpacing:1.2,opacity:.72}}>IDA FILE EXPLORER</div><strong style={{fontSize:18,color:'#f4f6fb'}}>{currentFolder?.name||folder}</strong></div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search this location" aria-label="Search files" style={{width:'min(240px,100%)',padding:'9px 12px',borderRadius:9,border:'1px solid #dce1e9',background:'#f5f6fa',color:'#252833',outline:'none'}}/>
      <button type="button" disabled={!selectedFiles.length} onClick={()=>{onDeleteMany(selectedFiles);setSelectedFiles([]);setSelected(null);setNotice('Moved selected files to Trash')}} style={{border:0,borderRadius:9,padding:'9px 12px',background:selectedFiles.length?'#fee2e2':'#374151',color:selectedFiles.length?'#991b1b':'#9ca3af',fontWeight:700,cursor:selectedFiles.length?'pointer':'not-allowed'}} title="Move selected files to Trash">Delete {selectedFiles.length||''}</button>
      <button type="button" onClick={e=>{e.stopPropagation();uploadRef.current?.click()}} style={{border:0,borderRadius:9,padding:'9px 12px',background:'#e9edf7',color:'#141720',fontWeight:700,cursor:'pointer'}}>{folder==='Music'?'＋ Import MP3 / audio':folder==='Videos'?'＋ Import video':'＋ Add files'}</button>
      <input ref={uploadRef} type="file" multiple accept={folder==='Music'?'audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac':folder==='Videos'?'video/*,.mp4,.webm,.mov,.m4v,.ogv,.ogg':undefined} style={{display:'none'}} onChange={e=>{const target=folder==='Home'?'Desktop':folder;onImport(e.currentTarget.files,target);e.currentTarget.value=''}}/>
      <button type="button" onClick={()=>{const target=folder==='Home'?'Desktop':folder;onNewFolder(target);setNotice('Folder created in '+(folders.find(item=>item.id===target)?.name||target));}} title="Create folder here" style={{border:'1px solid #64748b',borderRadius:9,padding:'9px 12px',background:'#334155',color:'#f8fafc',fontWeight:700,cursor:'pointer',opacity:1,visibility:'visible'}}>＋ Folder</button>
    </div>
    <div style={{display:'flex',flex:1,minHeight:0}}>
      <aside className="explorer-sidebar" style={{position:'relative',zIndex:2,width:155,flexShrink:0,padding:'12px 8px',borderRight:'1px solid hsl(var(--line))',background:'hsl(225 25% 10% / .9)',pointerEvents:'auto'}}>
        {roots.map(([label,target])=><button key={target} type="button" aria-current={folder===target?'page':undefined} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.preventDefault();e.stopPropagation();setFolder(target);setSelected(null);setQuery('')}} style={{...rowStyle,minHeight:44,padding:'9px 10px',background:folder===target?'#ffffff12':'transparent',borderColor:folder===target?'#ffffff28':'transparent',fontSize:14,marginBottom:4,pointerEvents:'auto'}}><span style={{width:25,height:25,display:'grid',placeItems:'center',color:target==='Home'?'#f3c969':target==='Desktop'?'#63b3ff':target==='Pictures'?'#c28bff':target==='Music'?'#62d6b0':'#ff9d68'}}>{target==='Home'?<Folder size={21}/>:target==='Desktop'?<SunMedium size={21}/>:target==='Pictures'?<Film size={21}/>:target==='Music'?<Music2 size={21}/>:<Play size={21}/>}</span>{label}</button>)}
        <div style={{fontSize:10,letterSpacing:1.1,opacity:.45,padding:'18px 10px 7px'}}>FOLDERS</div>
        {folders.filter(item=>item.parent==='Desktop'||item.parent==='Home').map(item=><button key={item.id} type="button" onClick={()=>openFolder(item)} style={{...rowStyle,minHeight:34,padding:'6px 10px',fontSize:12}}><Folder size={15}/><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</span></button>)}
      </aside>
      <section className="explorer-main explorer-file-view" tabIndex={0} onKeyDown={e=>{if(e.target!==e.currentTarget)return;const mod=e.ctrlKey||e.metaKey;const key=e.key.toLowerCase();if(mod&&key==='v'){e.preventDefault();onPaste();return}if(!selected)return;const folderItem=folderFolders.find(item=>item.id===selected);const appItem=visibleApps.find(item=>item.id===selected);const fileItem=shownFiles.find(item=>item.id===selected);const type=folderItem?'folder':appItem?'app':fileItem?'file':null;if(!type)return;if(mod&&key==='c'){e.preventDefault();onCopy(type,selected)}else if(mod&&key==='x'){e.preventDefault();onCut(type,selected)}else if(e.key==='Delete'){e.preventDefault();onDelete(type,selected)}}} style={{flex:1,minWidth:0,minHeight:0,overflow:'auto',padding:12}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onContext(e.clientX,e.clientY,{})}} onDragOver={e=>{if(dragged){e.preventDefault();e.dataTransfer.dropEffect='move'}}} onDrop={e=>{e.preventDefault();if(dragged)moveTo(dragged.type,dragged.id,rootDestination(folder))}}>
        {folder==='Home'&&<div style={{fontSize:12,opacity:.6,padding:'4px 8px 12px'}}>Quick access · Choose a location on the left or browse recent files below.</div>}
        {view==='list'&&<div style={{display:'flex',gap:8,padding:'4px 12px 8px',fontSize:10,letterSpacing:1,opacity:.45,textTransform:'uppercase'}}><span style={{flex:1}}>Name</span><span style={{width:130}}>Date modified</span><span style={{width:90}}>Type</span><span style={{width:70,textAlign:'right'}}>Size</span></div>}
        <div style={{display:'flex',flexDirection:'column',gap:3}}>
          {folderFolders.filter(showFolder).map(item=><div key={item.id} draggable onDragStart={e=>{setDragged({type:'folder',id:item.id});e.dataTransfer.setData('text/plain',item.id)}} onDragEnd={()=>setDragged(null)} onDragOver={e=>{if(dragged&&dragged.id!==item.id){e.preventDefault();e.stopPropagation()}}} onDrop={e=>{e.preventDefault();e.stopPropagation();if(dragged&&dragged.id!==item.id)moveTo(dragged.type,dragged.id,item.id)}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onContext(e.clientX,e.clientY,{folderItem:item})}} style={{...rowStyle,background:selected===item.id?'#e8f0ff':'transparent',borderColor:selected===item.id?'#b9d0fa':'transparent'}} onClick={()=>{setSelected(item.id);setSelectedFiles([])}} onDoubleClick={()=>openFolder(item)}><span style={iconStyle}><Folder size={23} color="#f3c969" fill="rgba(243,201,105,.18)"/></span><span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</span><span style={{width:130,fontSize:11,opacity:.6}}>{new Date(item.createdAt).toLocaleDateString()}</span><span style={{width:90,fontSize:11,opacity:.6}}>File folder</span><span style={{width:70,textAlign:'right',fontSize:11,opacity:.45}}>—</span></div>)}
          {visibleApps.filter(showApp).map(({id,app})=><div key={id} draggable onDragStart={e=>{setDragged({type:'app',id});e.dataTransfer.setData('text/plain',id)}} onDragEnd={()=>setDragged(null)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onContext(e.clientX,e.clientY,{app,appId:id})}} style={{...rowStyle,background:selected===id?'#e8f0ff':'transparent',borderColor:selected===id?'#b9d0fa':'transparent'}} onClick={()=>{setSelected(id);setSelectedFiles([])}} onDoubleClick={()=>onOpenApp({...app,name:id})}><span style={iconStyle}><IdaAppIcon name={app.name} size={27}/></span><span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appLabels[id]||app.name}</span><span style={{width:130,fontSize:11,opacity:.6}}>—</span><span style={{width:90,fontSize:11,opacity:.6}}>Application</span><span style={{width:70,textAlign:'right',fontSize:11,opacity:.45}}>—</span></div>)}
          {shownFiles.filter(showFile).map(file=><div key={file.id} draggable onDragStart={e=>{setDragged({type:'file',id:file.id});e.dataTransfer.setData('text/plain',file.id)}} onDragEnd={()=>setDragged(null)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onContext(e.clientX,e.clientY,{file})}} style={{...rowStyle,background:selectedFiles.includes(file.id)||selected===file.id?'#e8f0ff':openFileId===file.id?'#f0f4fa':'transparent',borderColor:selectedFiles.includes(file.id)||selected===file.id?'#b9d0fa':'transparent'}} onClick={e=>{setSelected(file.id);setOpenFileId(file.id);if(e.ctrlKey||e.metaKey||e.shiftKey)setSelectedFiles(old=>old.includes(file.id)?old.filter(id=>id!==file.id):[...old,file.id]);else setSelectedFiles([])}} onDoubleClick={()=>onOpen(file)}><input type="checkbox" aria-label={'Select '+file.name} checked={selectedFiles.includes(file.id)} onClick={e=>e.stopPropagation()} onChange={e=>setSelectedFiles(old=>e.target.checked?[...old.filter(id=>id!==file.id),file.id]:old.filter(id=>id!==file.id))} style={{width:16,height:16,flexShrink:0,accentColor:'#2563eb'}}/><span style={iconStyle}>{file.kind==='note'?<FileText size={23} color="#c4a1ff"/>:file.mime==='application/x-daword'?<FileText size={23} color="#60a5fa"/>:file.mime==='application/x-daexcellent'?<Sigma size={23} color="#4ade80"/>:file.mime==='application/x-dapower'?<FilePlus2 size={23} color="#fb923c"/>:file.mime?.startsWith('image/')?<SunMedium size={23} color="#66d9c2"/>:file.mime?.startsWith('video/')?<Film size={23} color="#ff8c7a"/>:file.mime?.startsWith('audio/')?<Music2 size={23} color="#ffce66"/>:file.mime?.includes('pdf')?<FileText size={23} color="#fb7185"/>:file.mime?.includes('zip')?<Folder size={23} color="#c084fc"/>:file.mime?.includes('json')||file.mime?.includes('javascript')||file.mime?.includes('html')?<FileText size={23} color="#fbbf24"/>:<FileText size={23} color="#9bbcff"/>}</span><span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name}</span><span style={{width:130,fontSize:11,opacity:.6}}>{new Date(file.createdAt).toLocaleDateString()}</span><span style={{width:90,fontSize:11,opacity:.6}}>{file.kind==='note'?'Note':file.mime==='application/x-daword'?'DaWord document':file.mime==='application/x-daexcellent'?'DaExcellent workbook':file.mime==='application/x-dapower'?'DaPower presentation':file.mime?.startsWith('image/')?'Image':file.mime?.startsWith('video/')?'Video':file.mime?.startsWith('audio/')?'Audio':file.mime?.includes('pdf')?'PDF':file.mime?.includes('zip')?'Archive':file.mime?.includes('json')?'JSON':file.mime?.includes('html')?'HTML':file.mime?.includes('javascript')?'Code':'Text document'}</span><span style={{width:70,textAlign:'right',fontSize:11,opacity:.45}}>{file.data?Math.max(1,Math.round(file.data.length/1024))+' KB':'—'}</span><button type="button" title={'Download '+file.name} aria-label={'Download '+file.name} onClick={e=>{e.stopPropagation();void downloadSavedFile(file)}} style={{border:0,borderRadius:7,padding:7,background:'#ffffff10',color:'#cbd5e1',display:'grid',placeItems:'center'}}><Download size={15}/></button></div>)}
          {folder==='Home'&&shownFiles.length===0&&folderFolders.length===0&&visibleApps.length===0&&<div className="explorer-empty"><Folder size={34}/><strong>Nothing here yet</strong><span>Files and folders you create will appear here.</span></div>}
          {folder!=='Home'&&folderFolders.length===0&&visibleApps.length===0&&shownFiles.filter(showFile).length===0&&<div className="explorer-empty" style={{marginTop:50}}><Folder size={34}/><strong>This folder is empty</strong><span>Create a folder to get started.</span></div>}
        </div>
        <div style={{padding:'16px 8px 4px',fontSize:11,opacity:.45}}>{folderFolders.length + shownFiles.length} folders · {visibleApps.length} apps</div>
      </section>
    </div>
  </div>
}

class DaMediaSafe extends Component<{file?:UserFile;volume:number;onVolumeChange:(v:number)=>void;onImportToMusic:(file:UserFile)=>void},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidUpdate(prevProps:{file?:UserFile}){if(this.state.failed && prevProps.file?.id!==this.props.file?.id)this.setState({failed:false})}
  render(){return this.state.failed ? <div className="explorer-empty"><Film size={36}/><strong>Could not open this media file</strong><span>DaMedia hit a file-specific error. Your files are safe. Try importing the file again if this continues.</span></div> : <DaMedia file={this.props.file} volume={this.props.volume} onVolumeChange={this.props.onVolumeChange} onImportToMusic={this.props.onImportToMusic}/>}
}

function DaMedia({file,volume,onVolumeChange,onImportToMusic}:{file?:UserFile;volume:number;onVolumeChange:(v:number)=>void;onImportToMusic:(file:UserFile)=>void}){
  const [mediaSrc,setMediaSrc]=useState(file?.data||'');
  const [mediaError,setMediaError]=useState('');
  const mediaElementRef=useRef<HTMLAudioElement|HTMLVideoElement>(null);
  useEffect(()=>{if(mediaElementRef.current)mediaElementRef.current.volume=Math.max(0,Math.min(1,volume/100))},[volume,mediaSrc]);
  useEffect(()=>{
    let alive=true;let objectUrl:string|undefined;setMediaError('');
    if(!file){setMediaSrc('');return}
    if(file.blobKey){
      getVideoBlob(file.blobKey).then(blob=>{if(alive&&blob){objectUrl=URL.createObjectURL(blob);setMediaSrc(objectUrl)}else if(alive){setMediaSrc('');setMediaError('This media file could not be found in browser storage. Please import it again.')}}).catch(()=>{if(alive){setMediaSrc('');setMediaError('Could not load this media file. Please import it again.')}});
    }else setMediaSrc(file.data||'');
    return()=>{alive=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[file?.id,file?.blobKey,file?.data]);
  if(!file)return <div className="explorer-empty"><Film size={42}/><strong>No media selected</strong><span>Open a photo, video, or audio file from DaFile Explorer.</span></div>;
  const isAudio=file.mime?.startsWith('audio/')||/\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name);
  return <div className="media-shell"><div className="media-toolbar"><div><span className="eyebrow">IDA</span><h2>DaMedia</h2></div><span>{file.name}</span></div><div className="media-stage">{mediaError?<div className="explorer-empty"><Film size={32}/><strong>Unable to open media</strong><span>{mediaError}</span></div>:!mediaSrc?<div className="explorer-empty"><Film size={32}/><span>Loading media…</span></div>:isAudio?<div style={{width:'min(680px,90%)',padding:28,border:'1px solid #343744',borderRadius:18,background:'linear-gradient(145deg,#171923,#0d0e14)',display:'grid',justifyItems:'center',gap:18,color:'#f4f4f5'}}><div style={{width:112,height:112,borderRadius:28,display:'grid',placeItems:'center',background:'linear-gradient(135deg,#8b5cf6,#312e81)',boxShadow:'0 16px 40px #0007'}}><Film size={54}/></div><strong style={{fontSize:20,textAlign:'center',overflowWrap:'anywhere'}}>{file.name.replace(/\.[^.]+$/,'')}</strong><span style={{color:'#a5a8b5',fontSize:13}}>Now playing in DaMedia</span><audio ref={mediaElementRef as React.RefObject<HTMLAudioElement>} key={file.id} src={mediaSrc} controls controlsList="nodownload" autoPlay style={{width:'100%'}} onLoadedMetadata={e=>{e.currentTarget.volume=Math.max(0,Math.min(1,volume/100))}} onVolumeChange={e=>onVolumeChange(Math.round(e.currentTarget.volume*100))} onError={()=>setMediaError('The browser could not decode this audio file. Try an MP3, WAV, or M4A file.')}/><button type="button" onClick={()=>onImportToMusic(file)} style={{border:0,borderRadius:999,padding:'10px 16px',background:'#f4f4f5',color:'#111',fontWeight:800,cursor:'pointer'}}>＋ Import to DaMusic</button></div>:file.mime?.startsWith('image/')?<img src={mediaSrc} alt={file.name}/>:<video ref={mediaElementRef as React.RefObject<HTMLVideoElement>} src={mediaSrc} controls controlsList="nodownload" autoPlay onVolumeChange={e=>onVolumeChange(Math.round(e.currentTarget.volume*100))} onError={()=>setMediaError('The browser could not play this video format.')}/>}</div></div>
}
function DaTrash({trash,onRestore,onEmpty,onPermanentDelete}:{trash:Array<{type:'app'|'file'|'folder';id:string;name:string;app?:AppItem;file?:UserFile;folder?:UserFolder;deletedAt:number}>;onRestore:(item:any)=>void;onEmpty:()=>void;onPermanentDelete:(item:any)=>void}){const [menu,setMenu]=useState<{x:number;y:number;item:any}|null>(null);const [confirm,setConfirm]=useState<any>(null);return <div className="trash-shell" onPointerDown={()=>setMenu(null)}><div className="trash-toolbar"><div><span className="eyebrow">IDA</span><h2>DaTrash</h2></div><button onClick={onEmpty} disabled={!trash.length}>Empty Trash</button></div>{trash.length===0?<div className="explorer-empty"><Trash2 size={42}/><strong>Trash is empty</strong><span>Deleted apps, files, and notes will appear here.</span></div>:<div className="explorer-grid">{trash.map(item=><div key={item.type+item.id} className="explorer-card trash-card" onContextMenu={e=>{e.preventDefault();e.stopPropagation();setMenu({x:e.clientX,y:e.clientY,item})}}><span className="explorer-card-icon">{item.type==='app'?<Trash2 size={27}/>:item.file?.kind==='note'?<FileText size={27}/>:<Folder size={27}/>}</span><strong>{item.name}</strong><small>{item.type==='app'?'App':item.file?.kind==='note'?'Note':'File'}</small></div>)}</div>}{menu&&<div className="desktop-context taskbar-context" style={{left:Math.min(menu.x,window.innerWidth-150),top:Math.min(menu.y,window.innerHeight-70),zIndex:100001}} onPointerDown={e=>e.stopPropagation()}><button onClick={()=>{onRestore(menu.item);setMenu(null)}}><Folder size={14}/> Restore</button><button onClick={()=>{setConfirm(menu.item);setMenu(null)}}><X size={14}/> Permanently delete</button></div>}{confirm&&<div className="rename-backdrop" onPointerDown={()=>setConfirm(null)}><div className="rename-dialog" onPointerDown={e=>e.stopPropagation()}><strong>Permanently delete?</strong><p>This will permanently delete “{confirm.name}”. This action cannot be undone.</p><div><button onClick={()=>setConfirm(null)}>Cancel</button><button className="rename-save" onClick={()=>{onPermanentDelete(confirm);setConfirm(null)}}>OK</button></div></div></div>}</div>}

function BankIcon({size=38}:{size?:number}) {
  return <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 19 24 9l18 10" /><path d="M9 20h30" /><path d="M11 39h26" />
    <path d="M13 21v15M21 21v15M27 21v15M35 21v15" /><path d="M7 39h34" />
  </svg>
}

function ControlCenter({ brightness, setBrightness, internetOn, setInternetOn, volume, setVolume, onVolumeChange, batteryLevel, batteryCharging, nowPlaying, onClose }: { brightness:number; setBrightness:(n:number)=>void; internetOn:boolean; setInternetOn:(v:boolean)=>void; volume:number; setVolume:(n:number)=>void; onVolumeChange:(n:number)=>void; batteryLevel:number|null; batteryCharging:boolean; nowPlaying:{title:string;artist:string;image?:string;playing:boolean}|null; onClose:()=>void }) {
  const now = new Date()
  return (
    <section className="control-center" role="dialog" aria-label="Control Center" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
      <div className="control-top">
        <div><strong>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><span>{now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
        <button onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      {nowPlaying && <div className="control-now-playing" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',margin:'0 0 12px',borderRadius:12,background:'rgba(255,255,255,.72)',border:'1px solid rgba(80,90,110,.22)',color:'#17191f',boxShadow:'0 2px 5px #0000000a'}}><div style={{width:48,height:48,flex:'0 0 48px',borderRadius:8,overflow:'hidden',background:'#d9dee8',display:'grid',placeItems:'center'}}>{nowPlaying.image?<img src={nowPlaying.image} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Music2 size={23}/>}</div><div style={{minWidth:0,flex:1}}><div style={{fontSize:11,fontWeight:700,color:'#656b76',marginBottom:3}}>NOW PLAYING · DaMusic</div><div style={{fontSize:14,fontWeight:750,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nowPlaying.title}</div><div style={{fontSize:12,color:'#656b76',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nowPlaying.artist}</div></div><div style={{display:'flex',alignItems:'center',gap:5}}><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('ida-music-remote-control',{detail:{action:'previous'}}))} aria-label="Previous track" title="Previous track" style={{border:0,background:'transparent',padding:5,cursor:'pointer',color:'#242833'}}><SkipBack size={19}/></button><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('ida-music-remote-control',{detail:{action:'toggle'}}))} aria-label={nowPlaying.playing?'Pause':'Play'} title={nowPlaying.playing?'Pause':'Play'} style={{border:0,borderRadius:8,background:'#0875ce',color:'#fff',padding:8,cursor:'pointer',display:'grid',placeItems:'center'}}>{nowPlaying.playing?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}</button><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('ida-music-remote-control',{detail:{action:'next'}}))} aria-label="Next track" title="Next track" style={{border:0,background:'transparent',padding:5,cursor:'pointer',color:'#242833'}}><SkipForward size={19}/></button></div></div>}
      <button className={'internet-toggle '+(internetOn?'active':'')} onClick={()=>setInternetOn(!internetOn)} type="button"><span><Wifi size={18}/><strong>Wi‑Fi</strong></span><small>{internetOn?'On':'Off'}</small></button>
      <label className="volume-row brightness-row"><SunMedium size={18}/><input type="range" min="20" max="100" value={brightness} onChange={e=>setBrightness(Number(e.target.value))} aria-label="Brightness"/><span>{brightness}%</span></label>
      <label className="volume-row">{volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}<input type="range" min="0" max="100" value={volume} onChange={e => setVolume(Number(e.target.value))} onPointerUp={e => onVolumeChange(Number((e.currentTarget as HTMLInputElement).value))} onKeyUp={e => { if(e.key.startsWith("Arrow")||e.key==="Home"||e.key==="End") onVolumeChange(Number((e.currentTarget as HTMLInputElement).value)) }} aria-label="Volume"/><span>{volume}%</span></label>
      {batteryLevel !== null && <div className="battery-status"><BatteryFull size={18}/><span>Battery</span><strong>{batteryLevel}%{batteryCharging?' · Charging':''}</strong></div>}
    </section>
  )
}

class DaMusicSafe extends Component<{volume:number},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error:Error){console.error('DaMusic window error:',error)}
  render(){return this.state.failed?<div className="explorer-empty" style={{height:'100%',minHeight:260}}><Music2 size={36}/><strong>DaMusic hit an error</strong><span>Your files are still saved. Close and reopen DaMusic to try again.</span><button type="button" onClick={()=>this.setState({failed:false})} style={{marginTop:12,border:0,borderRadius:9,padding:'9px 14px',cursor:'pointer'}}>Try again</button></div>:<MusicPanel volume={this.props.volume}/>}
}

function MusicPanel({ volume }: { volume: number }) {
  type PersonalTrack={id:string;title:string;artist:string;src:string;image?:string;blobKey:string};
  const [customTracks,setCustomTracks]=useState<PersonalTrack[]>(()=>{try{return JSON.parse(localStorage.getItem('ida-personal-music-v1')||'[]').map((t:PersonalTrack)=>({...t,src:''}))}catch{return []}});
  const [addDraft,setAddDraft]=useState<{fileId:string;name:string;blobKey:string;src:string;title:string;artist:string;image?:string}|null>(null);
  const [coverInput,setCoverInput]=useState<HTMLInputElement|null>(null);
  const libraryTracks=[...TRACKS,...customTracks];
  const audioRef=useRef<HTMLAudioElement>(null);
  const audioContextRef=useRef<AudioContext|null>(null);
  const analyserRef=useRef<AnalyserNode|null>(null);
  const audioSourceRef=useRef<MediaElementAudioSourceNode|null>(null);
  const [visualizerBars,setVisualizerBars]=useState<number[]>(()=>Array.from({length:96},()=>3));
  const visualizerBarsRef=useRef<number[]>(Array.from({length:64},()=>3));
  const [track,setTrack]=useState(()=>{try{return Math.max(0,Math.min(libraryTracks.length-1,Number(JSON.parse(localStorage.getItem('ida-music-state')||'{}').track)||0))}catch{return 0}});
  const [playing,setPlaying]=useState(false);
  const [currentTime,setCurrentTime]=useState(()=>{try{return Math.max(0,Number(JSON.parse(localStorage.getItem('ida-music-state')||'{}').time)||0)}catch{return 0}});
  const [duration,setDuration]=useState(0);
  const [view,setView]=useState<'player'|'playlists'|'create'|'add'>('player');
  const [playlistName,setPlaylistName]=useState('');
  const [editingPlaylistId,setEditingPlaylistId]=useState<number|null>(null);
  const [chosenSongs,setChosenSongs]=useState<number[]>(libraryTracks.map((_,i)=>i));
  const [playlists,setPlaylists]=useState<Array<{id:number;name:string;songs:number[]}>>(()=>{try{const p=JSON.parse(localStorage.getItem('ida-music-playlists')||'[]');return Array.isArray(p)?p:[]}catch{return []}});
  const [activeQueue,setActiveQueue]=useState<number[]>(()=>{try{const q=JSON.parse(localStorage.getItem('ida-music-state')||'{}').queue;return Array.isArray(q)&&q.length?q:libraryTracks.map((_,i)=>i)}catch{return libraryTracks.map((_,i)=>i)}});
  const [activePlaylistName,setActivePlaylistName]=useState(()=>{try{return JSON.parse(localStorage.getItem('ida-music-state')||'{}').playlist||'Default'}catch{return 'Default'}});
  const [toast,setToast]=useState<{title:string;artist:string;image?:string}|null>(null);
  const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{try{localStorage.setItem('ida-personal-music-v1',JSON.stringify(customTracks.map(({src,...t})=>t)))}catch{}},[customTracks]);
  useEffect(()=>{let alive=true;const urls:string[]=[];(async()=>{const hydrated=await Promise.all(customTracks.map(async t=>{if(t.src)return t;try{const blob=await getVideoBlob(t.blobKey);if(!blob)return t;const src=URL.createObjectURL(blob);urls.push(src);return {...t,src}}catch{return t}}));if(alive)setCustomTracks(old=>old.map(t=>hydrated.find(h=>h.id===t.id)||t))})();return()=>{alive=false;urls.forEach(URL.revokeObjectURL)}},[]);
  useEffect(()=>{const onImport=(event:Event)=>{const file=(event as CustomEvent).detail?.file as UserFile|undefined;if(!file?.blobKey){window.alert('This audio file is missing its saved media data. Please import it into DaFile Explorer again.');return}getVideoBlob(file.blobKey).then(blob=>{if(!blob){window.alert('IDA could not find the saved audio data for this file. Please import the MP3 into DaFile Explorer again.');return}const src=URL.createObjectURL(blob);setAddDraft({fileId:file.id,name:file.name,blobKey:file.blobKey,src,title:file.name.replace(/\.[^.]+$/,''),artist:'',image:undefined});setView('add')}).catch(error=>{console.error('DaMusic import failed:',error);window.alert('Could not load this audio file. Please import it into DaFile Explorer again.')})};window.addEventListener('ida-damusic-import-file',onImport);return()=>window.removeEventListener('ida-damusic-import-file',onImport)},[]);
  const current=libraryTracks[track]||libraryTracks[0];
  useEffect(()=>{if(!current)return;window.dispatchEvent(new CustomEvent('ida-music-state',{detail:{title:current.title,artist:'IDA Default',image:current.image,playing}}));return()=>{window.dispatchEvent(new CustomEvent('ida-music-state',{detail:null}))}},[current,playing]);
  const formatTime=(seconds:number)=>{if(!Number.isFinite(seconds)||seconds<0)return '0:00';const whole=Math.floor(seconds);return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0')};
  useEffect(()=>{try{localStorage.setItem('ida-music-playlists',JSON.stringify(playlists))}catch{}},[playlists]);
  useEffect(()=>{try{localStorage.setItem('ida-music-state',JSON.stringify({track,time:currentTime,queue:activeQueue,playlist:activePlaylistName}))}catch{}},[track,currentTime,activeQueue,activePlaylistName]);
  useEffect(()=>{if(audioRef.current)audioRef.current.volume=Math.max(0,Math.min(1,volume/100))},[volume]);
  useEffect(()=>{const audio=audioRef.current;if(!audio)return;audio.volume=Math.max(0,Math.min(1,volume/100));if(playing){audio.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false))}else audio.pause()},[volume,track,playing,view]);
  useEffect(()=>{
    const audio=audioRef.current;
    if(!audio)return;
    try{
      const AudioContextClass=window.AudioContext;
      if(!AudioContextClass)return;
      const context=new AudioContextClass();
      const analyser=context.createAnalyser();
      analyser.fftSize=2048;
      analyser.smoothingTimeConstant=0.34;
      const source=context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      audioContextRef.current=context;
      analyserRef.current=analyser;
      audioSourceRef.current=source;
    }catch(error){console.warn('DaMusic visualizer could not attach to audio:',error)}
    return()=>{try{audioSourceRef.current?.disconnect();analyserRef.current?.disconnect();void audioContextRef.current?.close()}catch{};audioSourceRef.current=null;analyserRef.current=null;audioContextRef.current=null};
  },[view]);
  useEffect(()=>{
    let frame=0;
    const analyser=analyserRef.current;
    if(!playing||!analyser){visualizerBarsRef.current=Array.from({length:64},()=>3);setVisualizerBars(visualizerBarsRef.current);return}
    const context=audioContextRef.current;
    if(context?.state==='suspended')void context.resume().catch(()=>{});
    const data=new Uint8Array(analyser.frequencyBinCount);
    let lastUiUpdate=0;
    const draw=(timestamp:number)=>{
      try{
        if(context?.state==='suspended')void context.resume().catch(()=>{});
        analyser.getByteFrequencyData(data);
        const count=96;
        const next=Array.from({length:count},(_,i)=>{
          // Use the strongest energy in each logarithmic band; averaging bins made
          // quieter tracks look almost flat even while the analyser was working.
          const start=Math.floor(Math.pow(i/count,1.75)*data.length);
          const end=Math.max(start+1,Math.floor(Math.pow((i+1)/count,1.75)*data.length));
          let peak=0;
          for(let j=start;j<Math.min(end,data.length);j++)peak=Math.max(peak,data[j]);
          const energy=Math.max(0,Math.min(1,(peak-7)/175));
          const target=3+Math.pow(energy,0.72)*32;
          const previous=visualizerBarsRef.current[i]??3;
          const response=target>previous?0.88:0.22;
          const height=previous+(target-previous)*response;
          visualizerBarsRef.current[i]=height;
          return Math.max(3,Math.min(36,height));
        });
        // Keep analysis smooth while limiting React renders to ~30fps.
        if(timestamp-lastUiUpdate>=33){setVisualizerBars(next);lastUiUpdate=timestamp}
      }catch(error){console.warn('DaMusic visualizer frame recovered from an error:',error)}
      finally{frame=window.requestAnimationFrame(draw)}
    };
    frame=window.requestAnimationFrame(draw);
    return()=>window.cancelAnimationFrame(frame);
  },[playing,track,view]);
  useEffect(()=>{if(audioRef.current&&currentTime>0){const a=audioRef.current;const restore=()=>{if(Math.abs(a.currentTime-currentTime)>1)a.currentTime=Math.min(currentTime,a.duration||currentTime)};if(a.readyState>=1)restore();else a.addEventListener('loadedmetadata',restore,{once:true});return()=>a.removeEventListener('loadedmetadata',restore)}},[]);
  useEffect(()=>()=>{if(toastTimer.current)clearTimeout(toastTimer.current)},[]);
  const showTrackToast=(index:number)=>{const t=libraryTracks[index];if(!t)return;const detail={title:t.title,artist:'IDA Default',image:t.image};setToast(detail);window.dispatchEvent(new CustomEvent('ida-now-playing',{detail}));if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),4200)};
  const toggle=()=>{if(!audioRef.current||!current)return;if(playing){audioRef.current.pause();setPlaying(false)}else{audioRef.current.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false))}};
  const selectTrack=(index:number,autoPlay=false,notify=false)=>{setTrack(index);setCurrentTime(0);setDuration(0);setPlaying(autoPlay);if(notify)showTrackToast(index)};
  const seek=(value:number)=>{if(!audioRef.current)return;audioRef.current.currentTime=value;setCurrentTime(value)};
  const nextTrack=()=>{const queue=activeQueue.length?activeQueue:libraryTracks.map((_,i)=>i);const position=queue.indexOf(track);const next=queue[(position+1+queue.length)%queue.length];selectTrack(next,true,true)}; const previousTrack=()=>{if(audioRef.current&&audioRef.current.currentTime>3){audioRef.current.currentTime=0;setCurrentTime(0);return}const queue=activeQueue.length?activeQueue:libraryTracks.map((_,i)=>i);const position=queue.indexOf(track);const previous=queue[(position-1+queue.length)%queue.length];selectTrack(previous,true,true)};
  useEffect(()=>{const onRemote=(event:Event)=>{const action=(event as CustomEvent).detail?.action;if(action==='toggle')toggle();else if(action==='next')nextTrack();else if(action==='previous')previousTrack()};window.addEventListener('ida-music-remote-control',onRemote);return()=>window.removeEventListener('ida-music-remote-control',onRemote)},[playing,track,activeQueue]);
  const createPlaylist=()=>{if(chosenSongs.length===0)return;const queue=[...chosenSongs];const name=playlistName.trim()||'My Playlist';if(editingPlaylistId!==null){setPlaylists(old=>old.map(p=>p.id===editingPlaylistId?{...p,name,songs:queue}:p));if(activePlaylistName===(playlists.find(p=>p.id===editingPlaylistId)?.name||'')){setActiveQueue(queue);setActivePlaylistName(name);if(!queue.includes(track)){setTrack(queue[0]);setCurrentTime(0)}}}else{const id=Date.now();setPlaylists(old=>[...old,{id,name,songs:queue}]);setActiveQueue(queue);setActivePlaylistName(name);setTrack(queue[0]);setCurrentTime(0);setDuration(0);setPlaying(false)}setEditingPlaylistId(null);setPlaylistName('');setView('playlists')};
  const playPlaylist=(playlist:{name:string;songs:number[]})=>{if(!playlist.songs.length)return;const queue=[...playlist.songs];setActiveQueue(queue);setActivePlaylistName(playlist.name);setTrack(queue[0]);setCurrentTime(0);setDuration(0);setView('player');setPlaying(true);window.setTimeout(()=>{const audio=audioRef.current;if(audio){audio.currentTime=0;audio.volume=Math.max(0,Math.min(1,volume/100));audio.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false))}},0)};
  const deletePlaylist=(id:number,name:string)=>{setPlaylists(old=>old.filter(p=>p.id!==id));if(editingPlaylistId===id){setEditingPlaylistId(null);setView('playlists')}if(activePlaylistName===name){setActiveQueue(libraryTracks.map((_,i)=>i));setActivePlaylistName('Default');setCurrentTime(0);setPlaying(false);if(audioRef.current){audioRef.current.pause();audioRef.current.currentTime=0}}}; const editPlaylist=(p:{id:number;name:string;songs:number[]})=>{setEditingPlaylistId(p.id);setPlaylistName(p.name);setChosenSongs([...p.songs]);setView('create')};
  const toastUi=toast?<div style={{position:'fixed',right:22,bottom:78,zIndex:2147483000,width:300,maxWidth:'calc(100% - 44px)',display:'flex',alignItems:'center',gap:12,padding:12,background:'#242630',border:'1px solid #41434e',borderRadius:14,boxShadow:'0 12px 38px #0008',animation:'idaNowPlayingIn .25s ease-out'}}><style>{'@keyframes idaNowPlayingIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}'}</style>{toast.image?<img src={toast.image} alt={toast.title+' cover'} style={{width:54,height:54,objectFit:'cover',borderRadius:8,flexShrink:0}}/>:<div style={{width:54,height:54,background:'#343640',borderRadius:8,display:'grid',placeItems:'center'}}><Music2 size={22}/></div>}<div style={{minWidth:0,flex:1}}><div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,color:'#b6bac5',marginBottom:4}}>NOW PLAYING</div><div style={{fontSize:14,fontWeight:750,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{toast.title}</div><div style={{fontSize:12,color:'#b6bac5',marginTop:3}}>{toast.artist}</div></div><button onClick={()=>setToast(null)} aria-label="Dismiss notification" style={{border:0,background:'transparent',color:'#a7aab4',cursor:'pointer',alignSelf:'flex-start'}}>×</button></div>:null;
  if(libraryTracks.length===0)return <div className="music-panel-content"><div className="music-hero"><div className="music-art"><Music2 size={48}/></div><div><span className="eyebrow">YOUR MUSIC</span><h2>DaMusic</h2><p>Your playlist is empty — ready for your songs.</p></div></div><div className="track-list" style={{minHeight:150,display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',padding:24}}><div><Music2 size={30} opacity={0.55}/><p style={{marginBottom:6,fontWeight:600}}>No songs yet</p><small>Send me an audio file or a direct audio link, plus the song artwork, and I’ll add it here.</small></div></div><div className="player-controls"><button className="play-button" disabled aria-label="No songs added yet" style={{opacity:.45,cursor:'not-allowed'}}><Play size={22} fill="currentColor"/></button></div></div>;
  const musicInputStyle:React.CSSProperties={background:'#20222c',color:'#f4f4f5',border:'1px solid #454957',borderRadius:9,padding:'11px 12px',outline:'none'};
  if(view==='add')return <div className="music-panel-content" style={{position:'relative',padding:22,color:'#f4f4f5'}}><button onClick={()=>setView('player')} style={{background:'#292b35',border:'1px solid #3b3e49',color:'white',borderRadius:10,padding:'10px 14px',cursor:'pointer'}}>← Back to DaMusic</button><span className="eyebrow" style={{display:'block',marginTop:20}}>PERSONAL LIBRARY</span><h2 style={{margin:'6px 0 8px'}}>Import to DaMusic</h2><p style={{color:'#a7aab4',marginTop:0}}>This song is saved only in this browser for your account on this device. It is not uploaded to other users.</p>{addDraft&&<div style={{display:'grid',gap:14,maxWidth:520}}><label style={{display:'grid',gap:6}}>Song name<input value={addDraft.title} onChange={e=>setAddDraft({...addDraft,title:e.target.value})} placeholder="Song name" style={musicInputStyle}/></label><label style={{display:'grid',gap:6}}>Artist<input value={addDraft.artist} onChange={e=>setAddDraft({...addDraft,artist:e.target.value})} placeholder="Artist name" style={musicInputStyle}/></label><label style={{display:'grid',gap:6}}>Cover art (optional)<input type="file" accept="image/*" onChange={e=>{const image=e.currentTarget.files?.[0];if(!image)return;const reader=new FileReader();reader.onload=()=>setAddDraft(old=>old?{...old,image:String(reader.result||'')}:old);reader.readAsDataURL(image)}} style={{color:'#d8dbe5'}}/>{addDraft.image&&<img src={addDraft.image} alt="Cover preview" style={{width:100,height:100,objectFit:'cover',borderRadius:10}}/>}</label><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button onClick={()=>{if(!addDraft)return;const item:PersonalTrack={id:'personal-'+Date.now(),title:addDraft.title.trim()||addDraft.name.replace(/\\.[^.]+$/,''),artist:addDraft.artist.trim()||'Unknown artist',src:addDraft.src,image:addDraft.image,blobKey:addDraft.blobKey};setCustomTracks(old=>[...old,item]);const index=libraryTracks.length;setTrack(index);setActiveQueue(old=>[...old,index]);setActivePlaylistName('Personal library');setCurrentTime(0);setDuration(0);setPlaying(true);setView('player');setAddDraft(null);window.setTimeout(()=>{const a=audioRef.current;if(a){a.src=item.src;a.volume=Math.max(0,Math.min(1,volume/100));a.play().catch(()=>setPlaying(false))}},50)}} style={{background:'#f4f4f5',color:'#111',border:0,borderRadius:999,padding:'11px 18px',fontWeight:800,cursor:'pointer'}}>Import song</button><button onClick={()=>{setAddDraft(null);setView('player')}} style={{background:'#292b35',color:'#f4f4f5',border:'1px solid #3b3e49',borderRadius:999,padding:'11px 18px',cursor:'pointer'}}>Cancel</button></div></div>}</div>;
    if(view==='playlists')return <div className="music-panel-content" style={{position:'relative',minHeight:'100%'}}><div style={{display:'flex',alignItems:'center',gap:12,marginBottom:22,flexWrap:'wrap'}}><button onClick={()=>setView('player')} style={{background:'#292b35',border:'1px solid #3b3e49',color:'white',borderRadius:10,padding:'10px 14px',cursor:'pointer'}}>← Back to DaMusic</button><div style={{flex:1,minWidth:120}}><span className="eyebrow">YOUR LIBRARY</span><h2 style={{margin:'4px 0'}}>Playlists</h2></div><button onClick={()=>{setEditingPlaylistId(null);setChosenSongs(libraryTracks.map((_,i)=>i));setPlaylistName('');setView('create')}} style={{background:'#f4f4f5',color:'#111',border:0,borderRadius:999,padding:'10px 15px',fontWeight:700,cursor:'pointer'}}>＋ Create playlist</button></div><div className="track-list"><div style={{display:'flex',alignItems:'center',gap:12,padding:14,borderBottom:'1px solid #2a2c35'}}><span style={{width:42,height:42,borderRadius:12,background:'linear-gradient(135deg,#555b6e,#252833)',display:'grid',placeItems:'center'}}><Music2 size={20}/></span><div style={{flex:1,minWidth:0}}><strong>Default</strong><small style={{display:'block',color:'#a7aab4',marginTop:4}}>{libraryTracks.length} songs · IDA Defaults</small></div><button onClick={()=>playPlaylist({name:'Default',songs:libraryTracks.map((_,i)=>i)})} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,minWidth:94,background:'#f4f4f5',color:'#111',border:0,borderRadius:999,padding:'10px 15px',fontSize:13,fontWeight:800,cursor:'pointer',boxShadow:'0 3px 10px #0003'}}><Play size={15} fill="currentColor"/> Play</button></div>{playlists.map(p=><div key={p.id} style={{position:'relative',zIndex:31,display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:'1px solid #2a2c35',flexWrap:'wrap'}}><span style={{width:42,height:42,borderRadius:12,background:'linear-gradient(135deg,#7c8498,#303341)',display:'grid',placeItems:'center',flexShrink:0,pointerEvents:'none'}}><Music2 size={20}/></span><div role="button" tabIndex={0} onClick={()=>editPlaylist(p)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();editPlaylist(p)}}} title="Open playlist editor" style={{position:'relative',zIndex:50,flex:1,minWidth:90,textAlign:'left',background:'transparent',color:'white',border:0,padding:'8px 4px',cursor:'pointer',pointerEvents:'auto',borderRadius:8}}><strong style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</strong><small style={{display:'block',color:'#a7aab4',marginTop:4}}>Open to edit songs and name · {p.songs.length} songs</small></div><button onClick={()=>playPlaylist(p)} style={{position:'relative',zIndex:32,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,minWidth:94,background:'#f4f4f5',color:'#111',border:0,borderRadius:999,padding:'10px 15px',fontSize:13,fontWeight:800,cursor:'pointer',boxShadow:'0 3px 10px #0003'}}><Play size={15} fill="currentColor"/> Play</button><button onClick={()=>editPlaylist(p)} aria-label={'Edit '+p.name} title="Edit playlist" style={{position:'relative',zIndex:32,background:'#292b35',color:'#f4f4f5',border:'1px solid #41434e',borderRadius:10,padding:'10px 11px',cursor:'pointer'}}><Settings2 size={16}/></button><button onClick={()=>deletePlaylist(p.id,p.name)} aria-label={'Delete '+p.name} title="Delete playlist" style={{position:'relative',zIndex:32,background:'#392126',color:'#ffb7bd',border:'1px solid #61343a',borderRadius:10,padding:'10px 11px',cursor:'pointer'}}><Trash2 size={16}/></button></div>)}</div>{playlists.length===0?<p style={{textAlign:'center',color:'#a7aab4',padding:22}}>Your playlists will appear here when you create one.</p>:null}</div>;
  if(view==='create')return <div className="music-panel-content" style={{position:'relative'}}>{toastUi}<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24,flexWrap:'wrap'}}><button onClick={()=>setView('playlists')} style={{background:'#292b35',border:0,color:'white',borderRadius:10,padding:'10px 14px',cursor:'pointer'}}>← Playlists</button><div style={{flex:1}}><span className="eyebrow">DAMUSIC PLAYLISTS</span><h2 style={{margin:'4px 0'}}>{editingPlaylistId!==null?'Edit playlist':'Create playlist'}</h2></div>{editingPlaylistId!==null?<button onClick={()=>{const p=playlists.find(x=>x.id===editingPlaylistId);if(p)deletePlaylist(p.id,p.name)}} style={{background:'#392126',color:'#ffb7bd',border:'1px solid #61343a',borderRadius:10,padding:'10px 13px',fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:7}}><Trash2 size={16}/> Delete playlist</button>:null}</div><label style={{display:'block',fontSize:13,color:'#a7aab4',marginBottom:8}}>Playlist name</label><input value={playlistName} onChange={e=>setPlaylistName(e.target.value)} placeholder="My playlist" style={{boxSizing:'border-box',width:'100%',maxWidth:480,padding:'12px 14px',borderRadius:10,border:'1px solid #343742',background:'#1b1d26',color:'#fff',fontSize:15,marginBottom:24}}/><h3 style={{margin:'0 0 8px'}}>Add songs</h3><p style={{margin:'0 0 16px',color:'#a7aab4',fontSize:13}}>Choose songs from your Default library.</p><div className="track-list">{[...chosenSongs,...libraryTracks.map((_,i)=>i).filter(i=>!chosenSongs.includes(i))].map((i,order)=>{const t=libraryTracks[i];const selected=chosenSongs.includes(i);return <label key={t.src} draggable={selected} onDragStart={e=>{if(!selected){e.preventDefault();return}e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move'}} onDragOver={e=>{if(selected)e.preventDefault()}} onDrop={e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));if(!Number.isInteger(from)||from===i||!chosenSongs.includes(from)||!chosenSongs.includes(i))return;setChosenSongs(old=>{const next=[...old];const a=next.indexOf(from),b=next.indexOf(i);if(a<0||b<0)return old;next.splice(a,1);next.splice(b,0,from);return next})}} style={{display:'flex',alignItems:'center',gap:14,padding:'15px 18px',borderBottom:'1px solid #2a2c35',cursor:selected?'grab':'pointer',opacity:selected?1:.72,background:selected?'rgba(255,255,255,.025)':'transparent'}}><input type="checkbox" checked={selected} onChange={e=>setChosenSongs(old=>e.target.checked?[...old,i]:old.filter(n=>n!==i))} style={{width:17,height:17,accentColor:'#facc15'}}/><span style={{color:selected?'#facc15':'#858895',width:22,fontSize:12,fontWeight:800,textAlign:'center'}}>{selected?chosenSongs.indexOf(i)+1:'+'}</span><span style={{flex:1,minWidth:0}}><strong style={{display:'block'}}>{t.title}</strong><small style={{display:'block',color:'#a7aab4',marginTop:4}}>{selected?'Priority '+(chosenSongs.indexOf(i)+1)+' · drag to reorder':'Not in playlist · select to add'}</small></span>{t.image?<img src={t.image} alt="" style={{width:46,height:46,objectFit:'cover',borderRadius:7}}/>:null}</label>})}</div><button onClick={createPlaylist} disabled={!chosenSongs.length} style={{marginTop:20,background:chosenSongs.length?'#f4f4f5':'#555',color:'#111',fontWeight:700,border:0,borderRadius:999,padding:'12px 22px',cursor:chosenSongs.length?'pointer':'not-allowed'}}>{editingPlaylistId!==null?'Save changes':'Create playlist'} · {chosenSongs.length} songs</button></div>;
  return <div className="music-panel-content" style={{position:'relative'}}>{toastUi}<div className="music-hero"><div className="music-art">{current.image?<img src={current.image} alt={current.title} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}/>:<Music2 size={48}/>}</div><div style={{flex:1,minWidth:0}}><span className="eyebrow">NOW PLAYING</span><h2>{current.title}</h2><p>{current.artist||'IDA Defaults'}</p></div><div className={`damusic-visualizer ${playing?'is-playing':''} `} role="img" aria-label={playing?'Live audio spectrum responding to the song':'Audio spectrum idle'}>{visualizerBars.map((height,i)=><span key={i} style={{height:`${height}px`,background:`hsl(${(i*5.6+270)%360} 92% 64%)`}} />)}</div></div><div className="music-progress-panel" style={{position:'relative',top:'auto',zIndex:1,padding:'12px 14px 14px',marginTop:4,marginBottom:18,background:'rgba(29,30,40,.97)',border:'1px solid #353744',borderRadius:16,boxShadow:'0 8px 22px rgba(0,0,0,.22)',backdropFilter:'blur(14px)'}}><input aria-label="Song progress" title="Seek through song" type="range" min={0} max={duration||0} step={0.1} value={Math.min(currentTime,duration||0)} disabled={!duration} onChange={e=>seek(Number(e.target.value))} style={{display:'block',width:'100%',height:5,accentColor:'#f4f4f5',cursor:duration?'pointer':'default',margin:'2px 0 0'}}/><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#a7aab4',marginTop:5,fontVariantNumeric:'tabular-nums'}}><span>{formatTime(currentTime)}</span><span>{duration?'-'+formatTime(Math.max(0,duration-currentTime)):'--:--'}</span></div><div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:22,marginTop:7,position:'relative'}}><button onClick={previousTrack} aria-label="Previous song" title="Previous song" style={{display:'grid',placeItems:'center',background:'transparent',color:'#f4f4f5',border:0,padding:7,cursor:'pointer'}}><SkipBack size={22} fill="currentColor"/></button><button onClick={toggle} aria-label={playing?'Pause':'Play'} title={playing?'Pause':'Play'} style={{display:'grid',placeItems:'center',width:44,height:44,background:'#f4f4f5',color:'#111',border:0,borderRadius:'50%',cursor:'pointer',boxShadow:'0 3px 10px #0004'}}>{playing?<Pause size={22} fill="currentColor"/>:<Play size={22} fill="currentColor"/>}</button><button onClick={nextTrack} aria-label="Next song" title="Next song" style={{display:'grid',placeItems:'center',background:'transparent',color:'#f4f4f5',border:0,padding:7,cursor:'pointer'}}><SkipForward size={22} fill="currentColor"/></button><button onClick={()=>setView('add')} title="Import song" aria-label="Import song" style={{position:'absolute',right:44,top:'50%',transform:'translateY(-50%)',display:'grid',placeItems:'center',background:'#292b35',border:'1px solid #3b3e49',color:'#f4f4f5',borderRadius:10,width:36,height:36,cursor:'pointer'}}><Plus size={18}/></button><button onClick={()=>setView('playlists')} title="Playlists" aria-label="Playlists" style={{position:'absolute',right:0,top:'50%',transform:'translateY(-50%)',display:'grid',placeItems:'center',background:'#292b35',border:'1px solid #3b3e49',color:'#f4f4f5',borderRadius:10,width:36,height:36,cursor:'pointer'}}><ListMusic size={18}/></button></div></div><audio ref={audioRef} src={current.src} onLoadedMetadata={e=>{setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:0);try{const saved=JSON.parse(localStorage.getItem('ida-music-state')||'{}');if(saved.track===track&&saved.time>0)e.currentTarget.currentTime=Math.min(saved.time,e.currentTarget.duration||saved.time)}catch{}}} onDurationChange={e=>setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:0)} onTimeUpdate={e=>setCurrentTime(e.currentTarget.currentTime)} onEnded={nextTrack} preload="metadata"/><div style={{fontSize:12,color:'#a7aab4',margin:'0 0 8px 5px'}}>PLAYING FROM · {activePlaylistName.toUpperCase()}</div><div className="track-list">{activeQueue.map((songIndex,i)=>{const t=libraryTracks[songIndex];return <button className={`track-row ${songIndex===track?'active':''}`} key={t.src} onClick={()=>{selectTrack(songIndex);}}><span>{i+1}</span><span><strong>{t.title}</strong><small>{t.artist||'IDA Defaults'}</small></span>{songIndex===track&&playing?<Gauge size={16}/>:null}</button>})}</div></div>
}
function DaculatorPanel(){
  const [display,setDisplay]=useState('0');
  const [toolMode,setToolMode]=useState<'calc'|'graph'>('calc');
  const [graphExpression,setGraphExpression]=useState('x^2');
  const [lineSlope,setLineSlope]=useState(1);
  const [lineIntercept,setLineIntercept]=useState(0);
  const [graphTrace,setGraphTrace]=useState<{x:number;y:number;locked:boolean}|null>(null);
  const [graphView,setGraphView]=useState({xmin:-10,xmax:10,ymin:-10,ymax:10});
  const graphDrag=useRef<{x:number;y:number;view:{xmin:number;xmax:number;ymin:number;ymax:number}}|null>(null);
  const graphMoved=useRef(false);





  const [advanced,setAdvanced]=useState(false);
  const [history,setHistory]=useState<string[]>([]);
  const [angle,setAngle]=useState<'DEG'|'RAD'>('DEG');
  const [justEvaluated,setJustEvaluated]=useState(false);
  const safeEvaluate=(raw:string,xValue=0):number=>{
    let input=raw.replace(/^\s*y\s*=/i,'').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'pi').replace(/τ/g,'tau').replace(/φ/g,'phi').replace(/\s/g,'');
    input=input.replace(/(\d|x|m|b|\))(?=(x|m|b|\())/gi,'$1*').replace(/(x|m|b)(?=\d)/gi,'$1*');
    let pos=0;
    const eat=(v:string)=>{if(input.slice(pos,pos+v.length)===v){pos+=v.length;return true}return false};
    const expression=():number=>{let n=term();while(true){if(eat('+'))n+=term();else if(eat('-'))n-=term();else break}return n};
    const term=():number=>{let n=power();while(true){if(eat('*'))n*=power();else if(eat('/'))n/=power();else if(eat('%'))n%=power();else break}return n};
    const power=():number=>{let n=atom();if(eat('^'))n=Math.pow(n,power());if(eat('!')){if(n<0||n>170||!Number.isInteger(n))throw Error('Factorial needs an integer');let f=1;for(let i=2;i<=n;i++)f*=i;n=f}return n};
    const atom=():number=>{
      if(eat('+'))return atom();if(eat('-'))return -atom();if(eat('(')){const n=expression();if(!eat(')'))throw Error('Missing )');return n}
      for(const fn of ['sqrt','sin','cos','tan','log','ln','abs']){if(eat(fn)){if(!eat('('))throw Error('Missing (');const v=expression();if(!eat(')'))throw Error('Missing )');const a=angle==='DEG'?Math.PI/180:1;return fn==='sqrt'?Math.sqrt(v):fn==='sin'?Math.sin(v*a):fn==='cos'?Math.cos(v*a):fn==='tan'?Math.tan(v*a):fn==='log'?Math.log10(v):fn==='ln'?Math.log(v):Math.abs(v)}}
      if(eat('pi'))return Math.PI;if(eat('tau'))return Math.PI*2;if(eat('phi'))return (1+Math.sqrt(5))/2;if(eat('x'))return xValue;if(eat('m'))return lineSlope;if(eat('b'))return lineIntercept;if(eat('e'))return Math.E;
      const m=input.slice(pos).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);if(!m)throw Error('Invalid expression');pos+=m[0].length;return Number(m[0])
    };
    const result=expression();if(pos<input.length||!Number.isFinite(result))throw Error('Math error');return result;
  };
  const pretty=(n:number)=>{if(!Number.isFinite(n))return 'Error';if(Math.abs(n)<1e-10&&n!==0)n=0;return Number(n.toPrecision(12)).toString()};
  const append=(v:string)=>{setDisplay(old=>{if(old==='Error'||justEvaluated){setJustEvaluated(false);return v==='.'?'0.':v}if(old==='0'&&v!=='.')return v;if(v==='.'&&old.split(/[+\-×÷()%]/).pop()?.includes('.'))return old;return old+v});setJustEvaluated(false)};
  const clear=()=>{setDisplay('0');setJustEvaluated(false)};
  const calculate=()=>{try{const result=pretty(safeEvaluate(display));setHistory(old=>[display+' = '+result,...old].slice(0,8));setDisplay(result);setJustEvaluated(true)}catch{setDisplay('Error');setJustEvaluated(true)}};
  const unary=(fn:(n:number)=>number,label:string)=>{try{const result=pretty(fn(safeEvaluate(display)));setHistory(old=>[label+'('+display+') = '+result,...old].slice(0,8));setDisplay(result);setJustEvaluated(true)}catch{setDisplay('Error');setJustEvaluated(true)}};
  const key=(label:string,kind='number',action?:()=>void)=> <button key={label} className={'dac-key dac-'+kind} onClick={action||(()=>append(label))}>{label}</button>;
  const graphPoints=useMemo(()=>{const pts:{x:number;y:number}[]=[];for(let i=0;i<=600;i++){const x=graphView.xmin+(graphView.xmax-graphView.xmin)*i/600;try{const y=safeEvaluate(graphExpression,x);if(Number.isFinite(y)&&y>=graphView.ymin-(graphView.ymax-graphView.ymin)*3&&y<=graphView.ymax+(graphView.ymax-graphView.ymin)*3)pts.push({x,y})}catch{} }return pts},[graphExpression,graphView,angle,lineSlope,lineIntercept]);
  const niceStep=(span:number)=>{const raw=Math.max(span/8,1e-12),power=Math.pow(10,Math.floor(Math.log10(raw))),unit=raw/power;return (unit<=1?1:unit<=2?2:unit<=5?5:10)*power};
  const xStep=niceStep(graphView.xmax-graphView.xmin),yStep=niceStep(graphView.ymax-graphView.ymin);
  return <div className="daculator-shell"><div className="dac-topline"><div className="dac-brand"><span className="dac-brand-icon"><Calculator size={21}/></span><div><strong>Daculator</strong><small>CALCULATE SOMETHING GREAT</small></div></div><button className={'dac-mode-toggle '+(advanced?'active':'')} onClick={()=>setAdvanced(v=>!v)} aria-label={advanced?'Switch to basic calculator':'Open advanced calculator'}><span>{advanced?'Basic':'Advanced'}</span><ChevronRight size={18} className={advanced?'dac-arrow-open':''}/></button></div>
    <div className="dac-tool-tabs"><button className={toolMode==='calc'?'active':''} onClick={()=>setToolMode('calc')}><Calculator size={14}/> Calculator</button><button className={toolMode==='graph'?'active':''} onClick={()=>setToolMode('graph')}><Sigma size={14}/> Graph</button></div>
    <div className="dac-display"><div className="dac-display-meta"><span>{advanced?'SCIENTIFIC MODE':'STANDARD MODE'}</span><button onClick={()=>setAngle(a=>a==='DEG'?'RAD':'DEG')}>{angle}</button></div><div className="dac-expression" title={display}>{display}</div><div className="dac-hint">Ready when you are</div></div>
    {toolMode==='graph'?<section className="dac-math-tool"><div className="dac-tool-heading"><div><strong>Function plotter</strong><small>Plot y = f(x) for one variable</small></div><span>−10 ≤ x ≤ 10</span></div><label className="dac-math-field"><span>f(x) =</span><input value={graphExpression} onChange={e=>setGraphExpression(e.target.value)} spellCheck={false} placeholder="e.g. x^2, y = 2x + 3, or y = mx + b"/></label>{/((\bm\b|\bb\b)|mx|xm)/i.test(graphExpression)&&<div className="dac-line-params"><label><span>Slope (m)</span><input type="number" step="0.5" value={lineSlope} onChange={e=>setLineSlope(Number(e.target.value)||0)}/></label><label><span>Intercept (b)</span><input type="number" step="0.5" value={lineIntercept} onChange={e=>setLineIntercept(Number(e.target.value)||0)}/></label></div>}<div className="dac-graph" onWheelCapture={e=>e.preventDefault()} aria-label={"Interactive graph of "+graphExpression}
onMouseDown={e=>{if(e.button!==0)return;graphDrag.current={x:e.clientX,y:e.clientY,view:graphView};graphMoved.current=false;e.currentTarget.classList.add('is-panning')}}
onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();if(graphDrag.current){const d=graphDrag.current,dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>3)graphMoved.current=true;if(graphMoved.current){const sx=(d.view.xmax-d.view.xmin)/r.width,sy=(d.view.ymax-d.view.ymin)/r.height;setGraphView({...d.view,xmin:d.view.xmin-dx*sx,xmax:d.view.xmax-dx*sx,ymin:d.view.ymin+dy*sy,ymax:d.view.ymax+dy*sy});return}}if(!graphTrace?.locked){const x=graphView.xmin+(e.clientX-r.left)/r.width*(graphView.xmax-graphView.xmin);try{const y=safeEvaluate(graphExpression,x);if(Number.isFinite(y))setGraphTrace({x,y,locked:false})}catch{setGraphTrace(null)}}}}
onMouseUp={e=>{graphDrag.current=null;e.currentTarget.classList.remove('is-panning')}}
onMouseLeave={e=>{graphDrag.current=null;e.currentTarget.classList.remove('is-panning');if(!graphTrace?.locked)setGraphTrace(null)}}
onWheel={e=>{e.preventDefault();e.stopPropagation();const r=e.currentTarget.getBoundingClientRect(),factor=e.deltaY<0?0.8:1.25,px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;setGraphView(v=>{const x=v.xmin+px*(v.xmax-v.xmin),y=v.ymax-py*(v.ymax-v.ymin),w=(v.xmax-v.xmin)*factor,h=(v.ymax-v.ymin)*factor;return{xmin:x-px*w,xmax:x+(1-px)*w,ymin:y-(1-py)*h,ymax:y+py*h}})}}
onClick={e=>{if(graphMoved.current){graphMoved.current=false;return}if(graphTrace?.locked){setGraphTrace(null);return}const r=e.currentTarget.getBoundingClientRect(),x=graphView.xmin+(e.clientX-r.left)/r.width*(graphView.xmax-graphView.xmin);try{const y=safeEvaluate(graphExpression,x);if(Number.isFinite(y))setGraphTrace({x,y,locked:true})}catch{setGraphTrace(null)}}}>
<svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><pattern id="dac-grid" width={100/(graphView.xmax-graphView.xmin)} height={100/(graphView.ymax-graphView.ymin)} patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#ffffff12" strokeWidth=".12"/></pattern></defs><rect width="100" height="100" fill="#101019"/>{Array.from({length:Math.min(30,Math.ceil((graphView.xmax-Math.ceil(graphView.xmin/xStep)*xStep)/xStep)+1)},(_,i)=>{const step=xStep;const x=Math.ceil(graphView.xmin/step)*step+i*step;return x<=graphView.xmax?<g key={'x'+i}><path d={`M${(x-graphView.xmin)/(graphView.xmax-graphView.xmin)*100} 0V100`} stroke="#ffffff0c" strokeWidth=".12"/><text x={(x-graphView.xmin)/(graphView.xmax-graphView.xmin)*100} y={Math.max(3,Math.min(97,(graphView.ymax)/(graphView.ymax-graphView.ymin)*100+2))} fill="#aaa6bd" fontSize="1.8" textAnchor="middle">{x}</text></g>:null})}{Array.from({length:Math.min(30,Math.ceil((graphView.ymax-Math.ceil(graphView.ymin/yStep)*yStep)/yStep)+1)},(_,i)=>{const step=yStep;const y=Math.ceil(graphView.ymin/step)*step+i*step;return y<=graphView.ymax?<g key={'y'+i}><path d={`M0 ${(graphView.ymax-y)/(graphView.ymax-graphView.ymin)*100}H100`} stroke="#ffffff0c" strokeWidth=".12"/><text x={Math.max(2,Math.min(97,(-graphView.xmin)/(graphView.xmax-graphView.xmin)*100-1))} y={(graphView.ymax-y)/(graphView.ymax-graphView.ymin)*100} fill="#aaa6bd" fontSize="1.8" textAnchor="end">{y}</text></g>:null})}{graphView.xmin<=0&&graphView.xmax>=0&&<path d={`M${(0-graphView.xmin)/(graphView.xmax-graphView.xmin)*100} 0V100`} stroke="#a89bc4" strokeWidth=".18"/>}{graphView.ymin<=0&&graphView.ymax>=0&&<path d={`M0 ${graphView.ymax/(graphView.ymax-graphView.ymin)*100}H100`} stroke="#a89bc4" strokeWidth=".18"/>}<polyline points={graphPoints.map(p=>`${(p.x-graphView.xmin)/(graphView.xmax-graphView.xmin)*100},${(graphView.ymax-p.y)/(graphView.ymax-graphView.ymin)*100}`).join(" ")} fill="none" stroke="#b9a2ff" strokeWidth=".32" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/>{graphTrace&&<g><path d={`M${(graphTrace.x-graphView.xmin)/(graphView.xmax-graphView.xmin)*100} 0V100 M0 ${(graphView.ymax-graphTrace.y)/(graphView.ymax-graphView.ymin)*100}H100`} stroke="#ffffff75" strokeWidth=".16" strokeDasharray=".7 1"/><circle cx={(graphTrace.x-graphView.xmin)/(graphView.xmax-graphView.xmin)*100} cy={(graphView.ymax-graphTrace.y)/(graphView.ymax-graphView.ymin)*100} r=".65" fill="#fff" stroke="#a78bfa" strokeWidth=".3"/></g>}</svg><div className="dac-graph-controls"><button onClick={e=>{e.stopPropagation();setGraphView(v=>{const x=(v.xmin+v.xmax)/2,y=(v.ymin+v.ymax)/2,w=(v.xmax-v.xmin)/1.5,h=(v.ymax-v.ymin)/1.5;return{xmin:x-w/2,xmax:x+w/2,ymin:y-h/2,ymax:y+h/2}})}} title="Zoom in">+</button><button onClick={e=>{e.stopPropagation();setGraphView(v=>{const x=(v.xmin+v.xmax)/2,y=(v.ymin+v.ymax)/2,w=(v.xmax-v.xmin)*1.5,h=(v.ymax-v.ymin)*1.5;return{xmin:x-w/2,xmax:x+w/2,ymin:y-h/2,ymax:y+h/2}})}} title="Zoom out">−</button><button onClick={e=>{e.stopPropagation();setGraphView({xmin:-10,xmax:10,ymin:-10,ymax:10});setGraphTrace(null)}} title="Reset view">⌂</button></div>{graphTrace&&<div className="dac-trace-readout"><strong>({Number(graphTrace.x.toFixed(3))}, {Number(graphTrace.y.toFixed(3))})</strong><small>{graphTrace.locked?"Pinned point · click to unpin":"Live coordinates · click to pin"}</small></div>}</div><p className="dac-tool-note">Try <code>x^2</code>, <code>sin(x)</code>, <code>cos(x)</code>, <code>sqrt(abs(x))</code>, or <code>1/x</code>. Trig uses the selected {angle} mode.</p></section>:<div className="dac-body"><div className="dac-keypad">{advanced&&<div className="dac-scientific">{key('sin(','function',()=>append('sin('))}{key('cos(','function',()=>append('cos('))}{key('tan(','function',()=>append('tan('))}{key('√','function',()=>unary(Math.sqrt,'√'))}{key('x²','function',()=>unary(n=>n*n,'x²'))}{key('xʸ','function',()=>append('^'))}{key('log(','function',()=>append('log('))}{key('ln(','function',()=>append('ln('))}{key('(','function',()=>append('('))}{key(')','function',()=>append(')'))}{key('π','function',()=>append('π'))}{key('e','function',()=>append('e'))}{key('τ','function',()=>append('τ'))}{key('φ','function',()=>append('φ'))}{key('!','function',()=>append('!'))}{key('1/x','function',()=>unary(n=>1/n,'1/x'))}{key('±','function',()=>unary(n=>-n,'±'))}</div>}
      <div className="dac-standard">{key('AC','clear',clear)}{key('⌫','clear',()=>setDisplay(v=>v==='Error'||v.length<=1?'0':v.slice(0,-1)))}{key('%','function',()=>append('%'))}{key('÷','operator',()=>append('÷'))}{key('7')}{key('8')}{key('9')}{key('×','operator',()=>append('×'))}{key('4')}{key('5')}{key('6')}{key('−','operator',()=>append('−'))}{key('1')}{key('2')}{key('3')}{key('+','operator',()=>append('+'))}{key('±','function',()=>unary(n=>-n,'±'))}{key('0')}{key('.')}{key('=','equals',calculate)}</div>
    </div><aside className="dac-history"><div className="dac-history-head"><strong>Recent</strong><button onClick={()=>setHistory([])} title="Clear history"><Sigma size={14}/></button></div>{history.length?history.map((item,i)=><button key={i} className="dac-history-item" onClick={()=>{const rhs=item.split(' = ').pop();if(rhs)setDisplay(rhs)}}>{item}</button>):<div className="dac-history-empty"><Sigma size={23}/><span>Your calculations<br/>will show up here</span></div>}</aside></div>
    }
    <div className="dac-footer"><span><span className="dac-status-dot"/> Ready</span><span>Made for IDA</span></div>
  </div>
}

function SettingsPanel({ taskbarTheme, taskbarManualColor, onTaskbarTheme, onTaskbarManualColor, onPreset, onUpload, iconScale, onScale, wallpaperRotation, wallpaperFade, includeOwnWallpaper, customWallpaper, onRotation, onFade, onIncludeOwn }: { taskbarTheme:'default'|'aurora'|'sunset'|'ocean'|'manual'; taskbarManualColor:string; onTaskbarTheme:(v:'default'|'aurora'|'sunset'|'ocean'|'manual')=>void; onTaskbarManualColor:(v:string)=>void; onPreset:(name:string)=>void; onUpload:(file:File)=>void; iconScale?:number; onScale?:(n:number)=>void; wallpaperRotation:boolean; wallpaperFade:boolean; includeOwnWallpaper:boolean; customWallpaper:string|null; onRotation:(v:boolean)=>void; onFade:(v:boolean)=>void; onIncludeOwn:(v:boolean)=>void }) { return <div className="settings-content"><div className="settings-heading"><Gear size={18}/><div><h2>DaSettings</h2><p>Personalize your IDA desktop.</p></div></div><h3>Wallpaper</h3><div className="wallpaper-grid">{Object.entries(WALLPAPERS).map(([name,value])=><button key={name} className="wallpaper-choice" onClick={()=>onPreset(name)}><img src={value} alt="" loading="lazy" decoding="async"/><span>{name}</span></button>)}</div><div className="wallpaper-controls"><label><span><strong>Wallpaper rotation</strong><small>Cycle the night wallpapers automatically.</small></span><input type="checkbox" checked={wallpaperRotation} onChange={e=>onRotation(e.target.checked)}/></label><label><span><strong>Fade between wallpapers</strong><small>Use a soft crossfade when the wallpaper changes.</small></span><input type="checkbox" checked={wallpaperFade} onChange={e=>onFade(e.target.checked)}/></label><label><span><strong>Include my wallpaper in rotation</strong><small>Your uploaded photo joins the 10-second wallpaper cycle.</small></span><input type="checkbox" checked={includeOwnWallpaper} disabled={!customWallpaper} onChange={e=>onIncludeOwn(e.target.checked)}/></label></div><label className="upload-wallpaper"><Download size={17}/><span>Upload custom wallpaper</span><input type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&onUpload(e.target.files[0])}/></label><div className="settings-section"><h3>Taskbar</h3><div className="taskbar-theme-grid">{(['default','aurora','sunset','ocean','manual'] as const).map(theme=><button type="button" key={theme} className={'taskbar-theme-choice '+(taskbarTheme===theme?'active':'')} onClick={()=>onTaskbarTheme(theme)}><span className={'taskbar-theme-swatch '+theme} style={theme==='manual'?{background:taskbarManualColor}:undefined}/><span>{theme==='default'?'Default':theme==='aurora'?'Aurora':theme==='sunset'?'Sunset':'Ocean'}</span></button>)}</div><label className="taskbar-color-row"><span><strong>Manual color</strong><small>Pick a custom taskbar color.</small></span><input type="color" value={taskbarManualColor} onChange={e=>{onTaskbarManualColor(e.target.value);onTaskbarTheme('manual')}}/></label></div><div className="setting-row"><div><strong>Desktop icon size</strong><small>Adjust the size of desktop apps.</small></div><select value={iconScale} onChange={e=>onScale?.(Number(e.target.value))}><option value={0.75}>Small</option><option value={0.9}>Default</option><option value={1.1}>Large</option><option value={1.3}>Extra large</option></select></div></div>
}
function ExternalAppPanel({url,name}:{url:string;name:string}){return <iframe className="external-app-frame" src={url} title={name} />}
function ShutdownScreen(){return <div className="shutdown-screen"><div className="shutdown-logo">IDA</div><div className="shutdown-spinner"/><div className="shutdown-message">Shutting down IDA</div><div className="shutdown-sub">Closing IDA...</div></div>}
function SleepScreen({onWake}:{onWake:()=>void}){const [bouncing,setBouncing]=useState(false);const [point,setPoint]=useState({x:40,y:100});const pointRef=useRef({x:40,y:100});const velocity=useRef({x:2.7,y:2.1});const logo=useRef<HTMLDivElement>(null);useEffect(()=>{const timer=window.setTimeout(()=>setBouncing(true),4000);return()=>window.clearTimeout(timer)},[]);useEffect(()=>{if(!bouncing)return;let raf=0;let last=0;const tick=(now:number)=>{if(now-last>15){last=now;const el=logo.current;const w=window.innerWidth,h=window.innerHeight,box=el?.getBoundingClientRect();const bw=box?.width||74,bh=box?.height||74;let x=pointRef.current.x+velocity.current.x,y=pointRef.current.y+velocity.current.y;if(x<=0||x+bw>=w)velocity.current.x*=-1;if(y<=0||y+bh>=h)velocity.current.y*=-1;x=Math.max(0,Math.min(w-bw,x));y=Math.max(0,Math.min(h-bh,y));pointRef.current={x,y};setPoint({x,y})}raf=window.requestAnimationFrame(tick)};raf=window.requestAnimationFrame(tick);return()=>window.cancelAnimationFrame(raf)},[bouncing]);return <div className="shutdown-screen sleep-transition-screen" role="button" tabIndex={0} aria-label="Wake IDA and open the lock screen" onClick={onWake} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onWake()}}} style={{cursor:'pointer',overflow:'hidden',userSelect:'none'}}>{!bouncing?<div className="sleep-preparing"><div className="sleep-logo-pulse"><HilalLogo/></div><div className="shutdown-message">Preparing IDA to sleep</div><div className="shutdown-sub">This may take a moment</div><div className="sleep-preparing-dots"><i/><i/><i/></div></div>:<><div className="sleep-bounce-hint">IDA is sleeping · Click anywhere to wake</div><div ref={logo} className="sleep-bouncing-logo" style={{position:'absolute',left:point.x,top:point.y}}><HilalLogo/></div></>}</div>}
function HilalLogo({small=false}:{small?:boolean}){return <span className={'hilal-logo '+(small?'hilal-small':'')} aria-hidden="true"><span className="hilal-crescent">☾</span></span>}
function RestartScreen({progress=0,status='Almost there...'}:{progress?:number;status?:string}){return <div className="restart-screen"><div className="restart-logo"><HilalLogo/></div><div className="restart-spinner"><span/></div><div className="restart-message">Restarting IDA</div><div className="restart-sub">Don't turn off the web</div><div className="restart-progress"><span style={{width:Math.max(0,Math.min(100,progress))+'%',transition:'width 240ms ease'}}/></div><div className="restart-status">{status} {progress>0&&<span>({progress}%)</span>}</div></div>}
function PowerMenu({onShutdown,onSleep,onRestart,onCancel}:{onShutdown:()=>void;onSleep:()=>void;onRestart:()=>void;onCancel:()=>void}){return <section className="power-menu" onPointerDown={e=>e.stopPropagation()}><div className="power-title"><Power size={18}/><strong>Power</strong></div><button onClick={onShutdown}><Power size={18}/><span><strong>Shut down</strong><small>Close IDA</small></span></button><button onClick={onSleep}><span className="sleep-icon">◐</span><span><strong>Sleep</strong><small>Keep IDA open and resume later</small></span></button><button onClick={onRestart}><span className="restart-icon">↻</span><span><strong>Restart IDA</strong><small>Restart the IDA desktop</small></span></button><button className="power-cancel" onClick={onCancel}>Cancel</button></section>}

function WindowFrame({app,state,active,onFocus,onPatch,onMinimize,onClose,onMaximize,onContextMenu,children}:{app:AppItem;state:any;active:boolean;onFocus:()=>void;onPatch:(p:any)=>void;onMinimize:()=>void;onClose:()=>void;onMaximize:()=>void;onContextMenu?:(x:number,y:number)=>void;children:React.ReactNode}) {
  const ref=useRef<HTMLElement>(null),drag=useRef<any>(null),resize=useRef<any>(null)
  const down=(e:React.PointerEvent)=>{if(state.maximized||e.button!==0)return;onFocus();const r=ref.current!.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,ox:r.left,oy:r.top};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}
  const move=(e:React.PointerEvent)=>{if(drag.current&&!state.maximized){const r=ref.current!.getBoundingClientRect();const nx=Math.max(0,Math.min(window.innerWidth-r.width,drag.current.ox+e.clientX-drag.current.x));const ny=Math.max(0,Math.min(window.innerHeight-48-r.height,drag.current.oy+e.clientY-drag.current.y));onPatch({x:nx,y:ny})}}
  const rd=(e:React.PointerEvent,edge:string)=>{if(state.maximized||immersive)return;onFocus();const r=ref.current!.getBoundingClientRect();resize.current={x:e.clientX,y:e.clientY,left:r.left,top:r.top,w:r.width,h:r.height,edge};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}
  const rm=(e:React.PointerEvent)=>{if(!resize.current||state.maximized||immersive)return;const q=resize.current,dx=e.clientX-q.x,dy=e.clientY-q.y;let left=q.left,top=q.top,w=q.w,h=q.h;if(q.edge.includes('e'))w=Math.max(420,q.w+dx);if(q.edge.includes('s'))h=Math.max(300,Math.min(q.h+dy,window.innerHeight-48-q.top));if(q.edge.includes('w')){const right=q.left+q.w;left=Math.max(0,Math.min(q.left+dx,right-420));w=right-left}if(q.edge.includes('n')){const bottom=q.top+q.h;top=Math.max(0,Math.min(q.top+dy,bottom-300));h=bottom-top}onPatch({x:left,y:top,width:w,height:h})}
  const resizeHandles=['n','e','s','w','ne','se','sw','nw']
  const action = (fn:()=>void) => (e:React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); e.stopPropagation(); fn() }
  const [immersive, setImmersive] = useState(app.name==='DaDrift')
  const [chromeVisible, setChromeVisible] = useState(app.name!=='DaDrift')
  const [closing, setClosing] = useState(false)
  const chromeTimer = useRef<number | undefined>(undefined)
  const topZone = useRef(false)
  const handleImmersiveMouseMove = (e:React.MouseEvent<HTMLElement>) => {
    if (!immersive) return
    const atRoof = e.clientY <= 8
    if (atRoof && !topZone.current) {
      topZone.current = true
      setChromeVisible(true)
      if (chromeTimer.current) window.clearTimeout(chromeTimer.current)
      chromeTimer.current = window.setTimeout(() => setChromeVisible(false), 2000)
    } else if (!atRoof) {
      topZone.current = false
    }
  }
  const requestClose = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 180)
  }
  const toggleImmersive = () => {
    setImmersive(v => {
      const next = !v
      topZone.current = false
      if (chromeTimer.current) window.clearTimeout(chromeTimer.current)
      setChromeVisible(!next)
      return next
    })
  }
  return <section ref={ref} className={'app-window desktop-window '+(active?'window-active ':'')+(immersive?'window-immersive ':'')+(closing?'window-closing':'')} style={{display:state.minimized?'none':undefined,left:immersive?0:(state.maximized?0:state.x),top:immersive?0:(state.maximized?0:state.y),right:immersive?0:(state.maximized?0:'auto'),bottom:immersive?0:(state.maximized?48:'auto'),width:immersive||state.maximized?'auto':state.width,height:immersive||state.maximized?'auto':state.height,zIndex:immersive?2147480001:Math.min(Number(state.z)||1,2147480000)}} onPointerDown={onFocus} onMouseMove={handleImmersiveMouseMove} onContextMenu={e=>{if(onContextMenu){e.preventDefault();e.stopPropagation();onContextMenu(e.clientX,e.clientY)}}} onContextMenuCapture={e=>{if((e.target as HTMLElement).closest('.desktop-context,.explorer-card,.desktop-file-tile,.app-tile,.explorer-main,.explorer-file-view,.trash-card')) return;if(onContextMenu){e.preventDefault();e.stopPropagation();onContextMenu(e.clientX,e.clientY)}}}>
    <div className={'window-bar '+(immersive && !chromeVisible ? 'chrome-hidden' : '')}>
      <div className="window-drag-area" onPointerDown={down} onPointerMove={move} onPointerUp={()=>drag.current=null} onDoubleClick={onMaximize}>
        <span className="window-title">{app.kind==='store'?<DappLogo size={19}/>:app.kind==='music'?<Music2 size={17}/>:app.kind==='trash'?<Trash2 size={17}/>:app.kind==='explorer'?<Folder size={17}/>:app.kind==='notes'?<FileText size={17}/>:app.kind==='word'?<FilePlus2 size={17}/>:app.kind==='excellent'?<Sigma size={17} color="#4ade80"/>:app.kind==='settings'?<Gear size={17}/>:app.kind==='media'?<Film size={17}/>:app.name==='DaCourt'?<Scale size={17}/>:app.name==='Daculator'?<Calculator size={17} color="#6ee7b7"/>:<BankIcon size={17}/>} {app.name}</span>
      </div>
      <div className="window-actions" onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
        <button type="button" onClick={action(onMinimize)} aria-label="Minimize"><Minus size={16}/></button>
        <button type="button" onClick={action(onMaximize)} aria-label={state.maximized?'Restore window':'Maximize window'}><Maximize2 size={15}/></button>
        <button type="button" onClick={action(toggleImmersive)} aria-label={immersive?'Exit fullscreen':'Fullscreen'}><ArrowUpDown size={15}/></button>
        <button type="button" className="close-btn" onClick={action(requestClose)} aria-label="Close"><X size={16}/></button>
      </div>
    </div>
    <div className="window-body">{children}</div>{!immersive&&!state.maximized&&resizeHandles.map(edge=><div key={edge} className={'resize-handle resize-'+edge} onPointerDown={e=>rd(e,edge)} onPointerMove={rm} onPointerUp={()=>resize.current=null}/>)}
  </section>
}
function IDATaskbar({taskbarTheme,taskbarManualColor,apps,openApps,windowLabels,windowsForTaskbar,active,clock,onStart,onSearch,onApp,onControl,onTaskbarContext,onTaskbarHover,onTaskbarLeave,onWindow,onReorder,onLogoDrop,language,languageMenuOpen,onLanguageMenu,onLanguage}:{files:UserFile[];onOpenFile:(f:UserFile)=>void;apps:string[];openApps:string[];windowLabels:Record<string,string>;windowsForTaskbar?:Record<string,any>;active:string|null;clock:Date;onStart:()=>void;onSearch:()=>void;onApp:(n:string)=>void;onControl:()=>void;onTaskbarContext:(x:number,y:number,n:string,key?:string)=>void;onTaskbarHover:(k:string,anchor?:number)=>void;onTaskbarLeave:()=>void;onWindow:(k:string)=>void;onReorder:(apps:string[])=>void;onLogoDrop:(id:string)=>void;taskbarTheme:'default'|'aurora'|'sunset'|'ocean'|'manual';taskbarManualColor:string;language:'en'|'cs'|'vi'|'ar-YE';languageMenuOpen:boolean;onLanguageMenu:()=>void;onLanguage:(v:'en'|'cs'|'vi'|'ar-YE')=>void}){const extra=openApps.filter(k=>!windowsForTaskbar?.[k]?.taskbarInstance);const [dragging,setDragging]=useState<string|null>(null);const [over,setOver]=useState<string|null>(null);const movePinned=(from:string,to:string)=>{if(from===to)return;const next=[...apps];const a=next.indexOf(from),b=next.indexOf(to);if(a<0||b<0)return;next.splice(a,1);next.splice(next.indexOf(to),0,from);onReorder(next)};const taskbarStyle=taskbarTheme==='manual'?{'--taskbar-manual':taskbarManualColor} as React.CSSProperties:undefined;return <div className={'taskbar taskbar-theme-'+taskbarTheme} style={taskbarStyle} onPointerDown={e=>e.stopPropagation()}><button className="ida-start" draggable onDragStart={e=>{e.dataTransfer.setData('ida-copy-source','ida-logo');e.dataTransfer.effectAllowed='copy'}} onDragOver={e=>{if(e.dataTransfer.types.includes('ida-copy-app')){e.preventDefault();e.dataTransfer.dropEffect='copy'}}} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('ida-copy-app');if(id)onLogoDrop(id)}} onClick={onStart} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onTaskbarContext(e.clientX,e.clientY,'IDA','IDA')}}><HilalLogo small/></button><button className="search-box" onClick={onSearch} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onTaskbarContext(e.clientX,e.clientY,'Search','Search')}}><Search size={17}/><span>Search</span></button><div className="taskbar-apps">{apps.map(n=>{if(n.startsWith('file:')){const file=files.find(f=>f.id===n.slice(5));if(!file)return null;return <button key={n} className="taskbar-app taskbar-file-app" title={file.name} onClick={()=>onOpenFile(file)}><span className="mini-icon tone-blue">{file.kind==='note'?<FileText size={20}/>:file.mime?.startsWith('image/')?(file.data?<img src={file.data} alt="" style={{width:26,height:26,objectFit:'cover',borderRadius:5}}/>:<SunMedium size={20}/>):file.mime?.startsWith('video/')?<Play size={20}/>:<Folder size={20}/>}</span></button>}const a=APPS.find(x=>x.name===appBaseId(n));if(!a)return null;return <button key={n} draggable onDragStart={()=>setDragging(n)} onDragEnter={e=>{e.preventDefault();setOver(n)}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragging)movePinned(dragging,n);setDragging(null);setOver(null)}} onDragEnd={()=>{setDragging(null);setOver(null)}} className={'taskbar-app '+(openApps.some(k=>(k===n||windowsForTaskbar?.[k]?.appName===n)&&windowsForTaskbar?.[k]?.taskbarInstance)?'running ':'')+(windowsForTaskbar?.[active||'']?.taskbarInstance&&windowsForTaskbar?.[active||'']?.appName===n?'selected ':'')+(dragging===n?'taskbar-dragging ':'')+(over===n&&dragging!==n?'taskbar-drop-target':'')} onClick={()=>onApp(n)} onMouseEnter={e=>{const candidates=openApps.filter(k=>(k===n||windowsForTaskbar?.[k]?.appName===n)&&windowsForTaskbar?.[k]?.taskbarInstance);const k=candidates.sort((a,b)=>(windowsForTaskbar?.[b]?.z||0)-(windowsForTaskbar?.[a]?.z||0))[0];if(k){const rect=e.currentTarget.getBoundingClientRect();onTaskbarHover(k,rect.left+rect.width/2)}}} onMouseLeave={onTaskbarLeave} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onTaskbarContext(e.clientX,e.clientY,n,n)}} title={n}><span className={'mini-icon tone-'+a.tone}>{<IdaAppIcon name={n} size={20}/>}</span></button>})}{extra.map(k=>{const w=windowsForTaskbar?.[k];const parsedName=typeof k==='string'&&k.startsWith('desktop:')?k.split(':')[1]:k; const base=w?.appName?APPS.find(a=>a.name===w.appName):APPS.find(a=>a.name===parsedName)|| (w?.kind==='media'?APPS.find(a=>a.name==='DaMedia'):w?.kind==='notes'?APPS.find(a=>a.name==='DaNotes'):w?.kind==='explorer'?APPS.find(a=>a.name==='DaFile Explorer'):k==='DaTrash'?APPS.find(a=>a.name==='DaTrash'):undefined);const tone=base?.tone||'blue';return <button key={k} className={'taskbar-app running '+(active===k?'selected ':'')+(w?.minimized?'minimized':'')} onClick={()=>onWindow(k)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onTaskbarContext(e.clientX,e.clientY,windowLabels[k]||k,k)}} title={windowLabels[k]||'Window'} onMouseEnter={e=>{const rect=e.currentTarget.getBoundingClientRect();onTaskbarHover(k,rect.left+rect.width/2)}} onMouseLeave={onTaskbarLeave}><span className={'mini-icon tone-'+tone}>{<IdaAppIcon name={base?.name||parsedName} size={20}/>}</span></button>})}</div><div className="tray"><div className="language-wrap"><button className="language-indicator" onClick={onLanguageMenu} aria-label="Language">{language==='en'?'ENG':language==='cs'?'CES':language==='vi'?'VIE':'ARA'}</button>{languageMenuOpen&&<div className="language-menu" onPointerDown={e=>e.stopPropagation()}><strong>Language</strong><button className={language==='en'?'active':''} onClick={()=>onLanguage('en')}>ENG · English</button><button onClick={()=>onLanguage('cs')}>CES · Czech</button><button onClick={()=>onLanguage('vi')}>VIE · Vietnamese</button><button onClick={()=>onLanguage('ar-YE')}>ARA · Yemeni Arabic</button></div>}</div><button onClick={onControl}><Wifi size={15}/><Volume2 size={15}/><BatteryFull size={17}/></button><div className="tray-clock">{clock.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}<small>{clock.toLocaleDateString([], {month:'2-digit',day:'2-digit',year:'numeric'})}</small></div></div></div>}
function LanguageRestartDialog({language,onCancel,onRestart}:{language:'en'|'cs'|'vi'|'ar-YE';onCancel:()=>void;onRestart:()=>void}){
  const label = language==='en' ? 'English' : language==='cs' ? 'Czech' : language==='vi' ? 'Vietnamese' : 'Yemeni Arabic'
  return <div className="rename-backdrop" onPointerDown={onCancel}><div className="rename-dialog language-restart-dialog" onPointerDown={e=>e.stopPropagation()}><strong>Restart to apply language change?</strong><p>The new language will be applied after restart.</p><div><button onClick={onCancel}>Cancel</button><button className="rename-save" onClick={onRestart}>Restart · {label}</button></div></div></div>
}
function TaskbarPreview({windowKey,win,app,anchor,onClose,onEnter,onLeave}:{windowKey:string;win:any;app?:AppItem;anchor:number|null;onClose:()=>void;onEnter:()=>void;onLeave:()=>void}){if(!win)return null;const left=Math.min(Math.max(8,(anchor??window.innerWidth/2)-112),window.innerWidth-232);return <div className="taskbar-preview" style={{left,pointerEvents:'auto'}} onMouseEnter={onEnter} onMouseLeave={onLeave}><button type="button" className="taskbar-preview-close" title="Close window" aria-label="Close window" onClick={e=>{e.stopPropagation();onClose()}}>×</button>{win.externalUrl?<iframe src={win.externalUrl} title={app?.name||windowKey} tabIndex={-1}/>:<div className="taskbar-preview-placeholder"><span className={'preview-icon tone-'+(app?.tone||'blue')}>{app?.name==='DaMusic'?<Music2 size={30}/>:app?.name==='DaSettings'?<Gear size={30}/>:app?.name==='DaCourt'?<Scale size={30}/>:app?.name==='DaNotes'?<FileText size={30}/>:app?.name==='DaTrash'?<Trash2 size={30}/>:app?.name==='DaMedia'?<Film size={30}/>:app?.name==='DaFile Explorer'?<Folder size={30}/>:<BankIcon size={30}/>}</span><strong>{app?.name||windowKey}</strong><small>{win.minimized?'Minimized window':'Open window'}</small></div>}<div className="taskbar-preview-label">{app?.name||windowKey}</div></div>}
function playSoftMenuChime(){try{const AudioContextClass=window.AudioContext||(window as any).webkitAudioContext;if(!AudioContextClass)return;const ctx=new AudioContextClass();const now=ctx.currentTime;const master=ctx.createGain();master.gain.setValueAtTime(0.0001,now);master.gain.exponentialRampToValueAtTime(0.055,now+0.035);master.gain.exponentialRampToValueAtTime(0.0001,now+0.72);master.connect(ctx.destination);[523.25,659.25].forEach((frequency,index)=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency,now+index*0.085);gain.gain.setValueAtTime(0.0001,now+index*0.085);gain.gain.exponentialRampToValueAtTime(index===0?0.48:0.3,now+index*0.085+0.025);gain.gain.exponentialRampToValueAtTime(0.0001,now+index*0.085+0.48);osc.connect(gain);gain.connect(master);osc.start(now+index*0.085);osc.stop(now+index*0.085+0.5)});window.setTimeout(()=>{void ctx.close().catch(()=>{})},1000)}catch{}}
function StartMenu({apps,onOpen,powerOpen,onPower,onShutdown,onSleep,onRestart,onCancel,onLock}:{apps:AppItem[];onOpen:(a:AppItem)=>void;powerOpen:boolean;onPower:()=>void;onShutdown:()=>void;onSleep:()=>void;onRestart:()=>void;onCancel:()=>void;onLock:()=>void}){return <section className="start-menu" onPointerDown={e=>e.stopPropagation()} onContextMenu={e=>{e.preventDefault();e.stopPropagation()}}><div className="start-head"><div className="ida-badge"><HilalLogo small/></div><div><strong>Welcome to IDA</strong><small>Your desktop apps</small></div></div><div className="start-section-title"><strong>Pinned</strong><span>All apps ›</span></div><div className="start-grid">{apps.map(a=><button key={a.name} draggable={true} onPointerDown={e=>e.stopPropagation()} onDragStart={e=>{e.stopPropagation();e.dataTransfer.clearData();e.dataTransfer.setData('ida-copy-app',a.name);e.dataTransfer.setData('text/plain',a.name);e.dataTransfer.effectAllowed='copy'}} onDragEnd={()=>{}} onClick={()=>onOpen(a)}><span className={'start-icon tone-'+a.tone}>{<IdaAppIcon name={a.name} size={26}/>}</span><span>{a.name}</span></button>)}</div><div className="start-recent"><strong>Quick access</strong><span>Open an app from your desktop or taskbar</span></div><div className="start-footer"><span>IDA OS</span><div style={{display:'flex',alignItems:'center',gap:8}}><button type="button" onClick={onLock} style={{border:0,background:'transparent',color:'inherit',cursor:'pointer',fontSize:12,fontWeight:600,padding:'7px 9px'}}>Sign out</button><button className="start-power" onClick={onPower} aria-label="Power options"><Power size={17}/></button></div></div>{powerOpen&&<PowerMenu onShutdown={onShutdown} onSleep={onSleep} onRestart={onRestart} onCancel={onCancel}/>}</section>}
function SearchPanel({apps,query,setQuery,onOpen}:{apps:AppItem[];query:string;setQuery:(s:string)=>void;onOpen:(a:AppItem)=>void}){const results=apps.filter(a=>a.name.toLowerCase().includes(query.toLowerCase()));return <section className="search-panel" onPointerDown={e=>e.stopPropagation()}><div className="search-big-input"><Search size={24}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search apps, settings, and more"/></div><div className="search-heading"><strong>{query ? 'Search results' : 'All apps'}</strong><span>{results.length} apps</span></div><div className="search-app-grid">{results.map(a=><button key={a.name} onClick={()=>onOpen(a)}><span className={'start-icon tone-'+a.tone}>{<IdaAppIcon name={a.name} size={26}/>}</span><span>{a.name}</span></button>)}</div></section>}
function DesktopFolderTile({folder,scale,left,top,selected,onSelect,onOpen,onContext,onMove,onDropTarget}:{folder:UserFolder;scale:number;left:number;top:number;selected:boolean;onSelect:()=>void;onOpen:()=>void;onContext:(x:number,y:number)=>void;onMove:(p:Position)=>void;onDropTarget:(target:string)=>void}){
  const drag=useRef<any>(null)
  const [dragPos,setDragPos]=useState<Position|null>(null)
  return <button data-drop-folder={folder.id} className={'desktop-file-tile desktop-folder-tile '+(selected?'app-tile-selected':'')} style={{left:(dragPos?.x??left)+'%',top:(dragPos?.y??top)+'%', ['--scale' as string]:scale,opacity:drag.current?.moved?0.58:1,transition:drag.current?.moved?'none':'left 120ms ease, top 120ms ease'}} onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,ox:left,oy:top,moved:false};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current||e.buttons!==1)return;const r=e.currentTarget.parentElement?.getBoundingClientRect();if(!r)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(!drag.current.moved&&(Math.abs(dx)>6||Math.abs(dy)>6))drag.current.moved=true;if(drag.current.moved)setDragPos({x:Math.max(0,Math.min(92,drag.current.ox+dx/r.width*100)),y:Math.max(0,Math.min(88,drag.current.oy+dy/r.height*100))})}} onPointerUp={e=>{const wasMoved=drag.current?.moved;const target=(document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null)?.closest('[data-drop-folder]')?.getAttribute('data-drop-folder');const finalPos=dragPos;drag.current=null;if(wasMoved&&target&&target!==folder.id)onDropTarget(target);else if(wasMoved&&finalPos)onMove(finalPos);else if(!wasMoved)onSelect();setDragPos(null);if((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId))(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)}} onDoubleClick={e=>{e.preventDefault();onOpen()}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onContext(e.clientX,e.clientY)}}><span className="desktop-file-icon tone-blue"><Folder size={30}/></span><span className="desktop-file-name" title={folder.name}>{folder.name}</span></button>
}
function DesktopFileTile({file,scale,left,top,selected,onSelect,onOpen,onContext,onMove,onDropTarget}:{file:UserFile;scale:number;left:number;top:number;selected:boolean;onSelect:()=>void;onOpen:()=>void;onContext:(x:number,y:number)=>void;onMove:(p:Position)=>void;onDropTarget:(target:string,type?:'app'|'file'|'folder',sourceId?:string)=>void}){
  const drag=useRef<any>(null)
  const [dragPos,setDragPos]=useState<Position|null>(null)
  return <button data-drop-folder={file.id} onDragOver={e=>{e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move'}} onDrop={e=>{e.preventDefault();e.stopPropagation();const type=e.dataTransfer.getData('ida-type') as 'app'|'file'|'folder';const id=e.dataTransfer.getData('ida-id')||e.dataTransfer.getData('ida-app')||e.dataTransfer.getData('ida-file');if(id&&id!==file.id)onDropTarget(file.id,type,id)}} className={'desktop-file-tile '+(selected?'app-tile-selected':'')} style={{left:(dragPos?.x??left)+'%',top:(dragPos?.y??top)+'%', ['--scale' as string]:scale,opacity:drag.current?.moved?0.58:1,transition:drag.current?.moved?'none':'left 120ms ease, top 120ms ease'}} onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,ox:left,oy:top,moved:false};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current||e.buttons!==1)return;const r=e.currentTarget.parentElement?.getBoundingClientRect();if(!r)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(!drag.current.moved&&(Math.abs(dx)>6||Math.abs(dy)>6))drag.current.moved=true;if(drag.current.moved)setDragPos({x:Math.max(0,Math.min(92,drag.current.ox+dx/r.width*100)),y:Math.max(0,Math.min(88,drag.current.oy+dy/r.height*100))})}} onPointerUp={e=>{const wasMoved=drag.current?.moved;const target=(document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null)?.closest('[data-drop-folder]')?.getAttribute('data-drop-folder');const finalPos=dragPos;drag.current=null;if(wasMoved&&target&&target!==file.id)onDropTarget(target,'file',file.id);else if(wasMoved&&finalPos)onMove(finalPos);else if(!wasMoved)onSelect();setDragPos(null);if((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId))(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)}} onDoubleClick={e=>{e.preventDefault();onOpen()}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onContext(e.clientX,e.clientY)}}><span className="desktop-file-icon tone-blue">{file.kind==='note'?<FileText size={30}/>:file.mime?.startsWith('image/')?<SunMedium size={30}/>:file.mime?.startsWith('video/')?<Play size={30}/>:<Folder size={30}/>}</span><span className="desktop-file-name" title={file.name}>{file.name}</span></button>
}
function RenameDialog({value,onChange,onCancel,onSave}:{value:string;onChange:(s:string)=>void;onCancel:()=>void;onSave:()=>void}){return <div className="rename-backdrop" onPointerDown={onCancel}><div className="rename-dialog" onPointerDown={e=>e.stopPropagation()}><strong>Rename</strong><input autoFocus value={value} onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onSave();if(e.key==='Escape')onCancel()}}/><div><button onClick={onCancel}>Cancel</button><button className="rename-save" onClick={onSave}>Rename</button></div></div></div>}
function DesktopContextMenu({menu,taskbarApps,clipboard,onAdd,onAddFile,onRemove,onRefresh,onNewFile,onNewFolder,onNewNote,onNewOfficeFile,onOpen,onOpenFile,onOpenFolder,onRename,onSettings,onCopy,onCut,onPaste,onDelete}:{menu:{x:number;y:number;scope:'desktop'|'explorer'|'window';app?:AppItem;appId?:string;file?:UserFile;folderItem?:UserFolder;folder?:ExplorerFolder};taskbarApps:string[];clipboard:{type:'app'|'file'|'folder';id:string;mode:'copy'|'cut'}|null;onAdd:(n:string)=>void;onAddFile:(id:string)=>void;onRemove:(n:string)=>void;onRefresh:()=>void;onNewFile:(location?:ExplorerFolder)=>void;onNewFolder:(location?:ExplorerFolder)=>void;onNewNote:(location?:ExplorerFolder)=>void;onNewOfficeFile:(app:'word'|'excellent'|'power',location?:ExplorerFolder)=>void;onOpen:(a:AppItem)=>void;onOpenFile:(f:UserFile)=>void;onOpenFolder:(f:UserFolder)=>void;onRename:(v:{type:'app'|'file'|'folder';id:string;name:string})=>void;onSettings:()=>void;onCopy:(type:'app'|'file'|'folder',id:string)=>void;onCut:(type:'app'|'file'|'folder',id:string)=>void;onPaste:()=>void;onDelete:(type:'app'|'file'|'folder',id:string)=>void}){const a=menu.app;const appId=menu.appId||a?.name;const f=menu.file;const sf=menu.folderItem;return <div className="desktop-context" style={{left:Math.min(menu.x,window.innerWidth-245),top:Math.min(menu.y,window.innerHeight-360),zIndex:2147483646}} onPointerDown={e=>e.stopPropagation()} onContextMenu={e=>{e.preventDefault();e.stopPropagation()}}>{(a||f||sf)&&<button onClick={()=>a?onOpen(a):f?onOpenFile(f):sf?onOpenFolder(sf):undefined}><Play size={14}/> {a?'Open app':f?'Open':'Open File'}</button>}{(a||f||sf)&&<button onClick={()=>onRename(a?{type:'app',id:appId!,name:appLabels[appId!]||appBaseId(appId!)}:f?{type:'file',id:f!.id,name:f!.name}:{type:'folder',id:sf!.id,name:sf!.name})}><Settings2 size={14}/> Rename</button>}{(a||f||sf)&&<><button onClick={()=>onCopy(a?'app':f?'file':'folder',appId||f?.id||sf!.id)}><Clipboard size={14}/> Copy</button><button onClick={()=>onCut(a?'app':f?'file':'folder',appId||f?.id||sf!.id)}><Scissors size={14}/> Cut</button></>}{a&&(taskbarApps.includes(appBaseId(a.name))?<button onClick={()=>onRemove(appBaseId(a.name))}><Minus size={14}/> Remove from taskbar</button>:<button onClick={()=>onAdd(appBaseId(a.name))}>＋ Add to taskbar</button>)} {f&&(taskbarApps.includes('file:'+f.id)?<button onClick={()=>onRemove('file:'+f.id)}><Minus size={14}/> Remove from taskbar</button>:<button onClick={()=>onAddFile(f.id)}>＋ Pin file to taskbar</button>)} {(a||f||sf)&&<button onClick={()=>onDelete(a?'app':f?'file':'folder',appId||f?.id||sf!.id)}><X size={14}/> Delete</button>}{!a&&!f&&!sf&&menu.scope==='desktop'&&<button onClick={onRefresh}><Sparkles size={14}/> Refresh</button>} {menu.folder&&<div className="new-menu-wrap"><button type="button"><Folder size={14}/> New <ChevronDown size={14} className="new-chevron"/></button><div className="new-submenu"><button type="button" onClick={()=>onNewFolder(menu.folder)}><Folder size={14}/> New Folder</button><button type="button" onClick={()=>onNewOfficeFile('word',menu.folder)}><FileText size={14}/> DaWord document</button><button type="button" onClick={()=>onNewOfficeFile('excellent',menu.folder)}><FilePlus2 size={14}/> DaExcellent workbook</button><button type="button" onClick={()=>onNewOfficeFile('power',menu.folder)}><FilePlus2 size={14}/> DaPower presentation</button></div></div>} {clipboard&&menu.folder&&<button onClick={onPaste}><Clipboard size={14}/> Paste</button>} {!a&&!f&&menu.folder==='Desktop'&&<button onClick={onSettings}><Gear size={14}/> IDA settings</button>}</div>}
function NativeWindowContextMenu({menu,onMinimize,onClose}:{menu:{x:number;y:number;scope:'desktop'|'explorer'|'window';windowKey?:string};onMinimize:()=>void;onClose:()=>void}){return <div className="desktop-context taskbar-context" style={{left:Math.min(menu.x,window.innerWidth-205),top:Math.min(menu.y,window.innerHeight-145)}} onPointerDown={e=>e.stopPropagation()}><button onClick={onMinimize}><Minus size={14}/> Minimize</button><button onClick={onClose}><X size={14}/> Close</button></div>}
function TaskbarContextMenu({menu,onRemove,onOpen,onClose}:{menu:{x:number;y:number;name:string;key?:string;running?:boolean};onRemove:()=>void;onOpen:()=>void;onClose:()=>void}){const running=!!menu.running;return <div className="desktop-context taskbar-context" style={{left:Math.min(menu.x,window.innerWidth-205),top:Math.min(menu.y,window.innerHeight-125),zIndex:100001}} onPointerDown={e=>e.stopPropagation()}><button onClick={onOpen}><Play size={14}/> Open app</button>{running&&<button onClick={onClose}><X size={14}/> Close app</button>}{!running&&<button onClick={onRemove}><Minus size={14}/> Remove from taskbar</button>}<button onClick={onClose}>Cancel</button></div>}