/* ==================== profile.js ====================
   User profile + daily logs (sleep/water/mood/workout),
   the profile modal, and the context builder that feeds
   the AI coach real user data. */

let userProfile = loadJSON('rahafit_profile', {});
let dailyLogs = loadJSON('rahafit_logs', []); // [{date, sleep, water, mood, workout}]

function todayStr(){ return new Date().toISOString().slice(0,10); }
function getTodayLog(){ return dailyLogs.find(l => l.date === todayStr()); }

function fillProfileForm(){
  ['age','gender','height','weight','goal','level','injuries','equipment'].forEach(id=>{
    const el = document.getElementById('profile-'+id);
    if(el && userProfile[id] !== undefined) el.value = userProfile[id];
  });
}

function fillLogForm(){
  const log = getTodayLog();
  ['sleep','water','mood','workout'].forEach(id=>{
    const el = document.getElementById('log-'+id);
    if(el) el.value = (log && log[id] !== undefined) ? log[id] : '';
  });
}

function openProfile(){
  fillProfileForm();
  fillLogForm();
  document.getElementById('profile-overlay').classList.add('open');
}
function closeProfile(){
  document.getElementById('profile-overlay').classList.remove('open');
}

function saveProfile(){
  userProfile = {
    age: document.getElementById('profile-age').value.trim(),
    gender: document.getElementById('profile-gender').value,
    height: document.getElementById('profile-height').value.trim(),
    weight: document.getElementById('profile-weight').value.trim(),
    goal: document.getElementById('profile-goal').value.trim(),
    level: document.getElementById('profile-level').value,
    injuries: document.getElementById('profile-injuries').value.trim(),
    equipment: document.getElementById('profile-equipment').value.trim()
  };
  saveJSON('rahafit_profile', userProfile);
  const status = document.getElementById('profile-save-status');
  if(status){ status.textContent = t('profileSaved'); setTimeout(()=>{ status.textContent=''; }, 2200); }
}

function saveDailyLog(){
  const entry = {
    date: todayStr(),
    sleep: document.getElementById('log-sleep').value.trim(),
    water: document.getElementById('log-water').value.trim(),
    mood: document.getElementById('log-mood').value,
    workout: document.getElementById('log-workout').value.trim()
  };
  dailyLogs = dailyLogs.filter(l => l.date !== entry.date);
  dailyLogs.push(entry);
  dailyLogs.sort((a,b)=> a.date.localeCompare(b.date));
  dailyLogs = dailyLogs.slice(-30); // keep last 30 days only
  saveJSON('rahafit_logs', dailyLogs);
  const status = document.getElementById('log-save-status');
  if(status){ status.textContent = t('logSaved'); setTimeout(()=>{ status.textContent=''; }, 2200); }
}

const MOOD_LABEL = { ar:{happy:'مبسوط',neutral:'عادي',tired:'تعبان',low:'مضايق'}, en:{happy:'good',neutral:'neutral',tired:'tired',low:'low'} };

function buildUserContext(lang){
  const p = userProfile;
  const known = [];
  const genderLabel = p.gender === 'male' ? (lang==='ar'?'ذكر':'male') : p.gender === 'female' ? (lang==='ar'?'أنثى':'female') : p.gender;
  const pairs = lang==='ar'
    ? [['العمر',p.age],['النوع',genderLabel],['الطول',p.height && p.height+' سم'],['الوزن',p.weight && p.weight+' كجم'],['الهدف',p.goal],['مستوى اللياقة',p.level],['إصابات',p.injuries],['الأدوات المتاحة',p.equipment]]
    : [['Age',p.age],['Gender',genderLabel],['Height',p.height && p.height+' cm'],['Weight',p.weight && p.weight+' kg'],['Goal',p.goal],['Fitness level',p.level],['Injuries',p.injuries],['Equipment available',p.equipment]];
  pairs.forEach(([label,val])=>{ if(val) known.push(`${label}: ${val}`); });

  const recentLogs = dailyLogs.slice(-7).map(l=>{
    const mood = l.mood ? (MOOD_LABEL[lang][l.mood] || l.mood) : (lang==='ar'?'؟':'?');
    return lang==='ar'
      ? `${l.date} — نوم: ${l.sleep||'؟'} ساعة، ماء: ${l.water||'؟'} كوب، مزاج: ${mood}، تمرين: ${l.workout||'؟'}`
      : `${l.date} — sleep: ${l.sleep||'?'}h, water: ${l.water||'?'} cups, mood: ${mood}, workout: ${l.workout||'?'}`;
  });

  const header = lang==='ar' ? 'بيانات المستخدم المعروفة حاليًا:' : 'Known user data right now:';
  const logHeader = lang==='ar' ? 'سجل آخر أيام (الأحدث آخر السطر):' : 'Recent daily log (most recent last):';
  const noneNote = lang==='ar' ? '(لسه مفيش بيانات محفوظة)' : '(no saved data yet)';
  const missingNote = lang==='ar'
    ? 'أي حقل مش موجود في القايمة دي معناه إن المستخدم لسه ما قالهوش — ماتخترعش قيمة له؛ اسأله عنه لو محتاجه عشان توصية دقيقة.'
    : 'Any field not listed above has not been provided by the user yet — never invent a value for it; ask them if you need it for an accurate recommendation.';

  let out = header + '\n' + (known.length ? known.join('\n') : noneNote) + '\n\n';
  out += logHeader + '\n' + (recentLogs.length ? recentLogs.join('\n') : noneNote) + '\n\n';
  out += missingNote;
  return out;
}

