import i18n from './i18n.js';

export const state={user:null,route:'landing',isOffline:false,theme:localStorage.getItem('mindvault_theme')||'dark',notes:[],ideas:[],productivity:{todos:[],reminders:[],focus:'',pomodoro:{work:25,break:5}},stats:{},activity:[],searchResults:[]};
export const bus=new EventTarget();
export function setState(patch){Object.assign(state,patch);bus.dispatchEvent(new CustomEvent('change',{detail:patch}))}
export function formatDate(value){
  const lng = i18n.resolvedLanguage || i18n.language || undefined;
  return new Intl.DateTimeFormat(lng, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
export function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
