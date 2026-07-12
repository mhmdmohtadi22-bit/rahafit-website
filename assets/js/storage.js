/* ==================== storage.js ====================
   Generic persistence helpers (localStorage today, easy to
   swap/extend to Supabase tables later) + Supabase project
   config used by auth.js and chat.js. */

const SUPABASE_URL = 'https://xncdmrvtxotexaputrkb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-uLtAnaLfO272mOIhnZmhw_Lwota--8';

function loadJSON(key, fallback){
  try{ const v = JSON.parse(localStorage.getItem(key)); return v || fallback; }catch(e){ return fallback; }
}
function saveJSON(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){ /* storage unavailable */ }
}
