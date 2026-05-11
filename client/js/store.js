export const state={user:null,route:'landing',isOffline:false,theme:localStorage.getItem('mindvault_theme')||'dark',notes:[],files:[],ideas:[],productivity:{todos:[],reminders:[],focus:'',pomodoro:{work:25,break:5}},stats:{},activity:[],searchResults:[]};
export const bus=new EventTarget();
export function setState(patch){Object.assign(state,patch);bus.dispatchEvent(new CustomEvent('change',{detail:patch}))}
export function formatDate(value){return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value))}
export function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
