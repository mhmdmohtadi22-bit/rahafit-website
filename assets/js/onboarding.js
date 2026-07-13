/* ==================== onboarding.js ====================
   First-run onboarding wizard. Collects age, gender, height,
   weight, goal, activity level, training days/week, and
   injuries — then feeds them into userProfile (profile.js)
   so the AI coach is personalized from message one.
   Triggers: right after signup, and right before the first
   chat message if the user hasn't completed it yet. Can also
   be reopened from the profile modal to edit answers. */

const ONB_TOTAL_STEPS = 6; // data steps only (excludes welcome + done screens)

const ONB_GOAL_LABEL = {
  ar: { lose_weight:'خسارة وزن', build_muscle:'بناء عضل', fitness:'لياقة بدنية', general_health:'صحة عامة' },
  en: { lose_weight:'Lose weight', build_muscle:'Build muscle', fitness:'General fitness', general_health:'General health' }
};
const ONB_ACTIVITY_LABEL = {
  ar: { sedentary:'قليل الحركة', light:'نشاط خفيف', moderate:'نشاط متوسط', high:'نشاط عالي' },
  en: { sedentary:'Sedentary', light:'Lightly active', moderate:'Moderately active', high:'Very active' }
};
const ONB_DAYS_LABEL = {
  ar: { '1-2':'1-2 أيام في الأسبوع', '3-4':'3-4 أيام في الأسبوع', '5-6':'5-6 أيام في الأسبوع', '7':'يوميًا' },
  en: { '1-2':'1-2 days/week', '3-4':'3-4 days/week', '5-6':'5-6 days/week', '7':'Every day' }
};
const ONB_NO_INJURY_LABEL = { ar:'لا يوجد', en:'None' };

let onbStep = 0;
let onbData = {};

function renderOnbProgress(){
  const wrap = document.getElementById('onb-progress');
  if(!wrap) return;
  if(onbStep === 0 || onbStep === ONB_TOTAL_STEPS + 1){
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'flex';
  wrap.innerHTML = '';
  for(let i = 1; i <= ONB_TOTAL_STEPS; i++){
    const dot = document.createElement('span');
    dot.className = 'onb-dot' + (i < onbStep ? ' done' : i === onbStep ? ' active' : '');
    wrap.appendChild(dot);
  }
}

function showOnbStep(n){
  onbStep = n;
  document.querySelectorAll('.onb-step').forEach(el=>{
    el.classList.toggle('active', Number(el.dataset.step) === n);
  });
  renderOnbProgress();
}

function onbSelectOption(field, btnEl){
  const group = btnEl.parentElement;
  group.querySelectorAll('.onb-option-card').forEach(b => b.classList.remove('selected'));
  btnEl.classList.add('selected');
  onbData[field] = btnEl.dataset.value;
}

function onbSelectInjury(btnEl){
  const group = btnEl.parentElement;
  group.querySelectorAll('.onb-option-card').forEach(b => b.classList.remove('selected'));
  btnEl.classList.add('selected');
  onbData.hasInjury = btnEl.dataset.value;
  const detailWrap = document.getElementById('onb-injury-detail-wrap');
  detailWrap.style.display = (btnEl.dataset.value === 'yes') ? 'block' : 'none';
}

function onbNext(){
  if(onbStep === 1){
    onbData.age = document.getElementById('onb-age').value.trim();
    onbData.gender = document.getElementById('onb-gender').value;
  }
  if(onbStep === 2){
    onbData.height = document.getElementById('onb-height').value.trim();
    onbData.weight = document.getElementById('onb-weight').value.trim();
  }
  if(onbStep === 6){
    onbData.injuryDetail = document.getElementById('onb-injury-detail').value.trim();
  }
  if(onbStep < ONB_TOTAL_STEPS + 1) showOnbStep(onbStep + 1);
}

function onbBack(){
  if(onbStep > 0) showOnbStep(onbStep - 1);
}

function onbApplyData(){
  const lang = currentLang || 'ar';
  if(onbData.age) userProfile.age = onbData.age;
  if(onbData.gender) userProfile.gender = onbData.gender;
  if(onbData.height) userProfile.height = onbData.height;
  if(onbData.weight) userProfile.weight = onbData.weight;
  if(onbData.goal) userProfile.goal = ONB_GOAL_LABEL[lang][onbData.goal] || onbData.goal;
  if(onbData.activityLevel) userProfile.activityLevel = ONB_ACTIVITY_LABEL[lang][onbData.activityLevel] || onbData.activityLevel;
  if(onbData.daysPerWeek) userProfile.daysPerWeek = ONB_DAYS_LABEL[lang][onbData.daysPerWeek] || onbData.daysPerWeek;
  if(onbData.hasInjury === 'yes'){
    userProfile.injuries = onbData.injuryDetail || (lang==='ar' ? 'فيه إصابة (بدون تفاصيل)' : 'Has an injury (no details given)');
  } else if(onbData.hasInjury === 'no'){
    userProfile.injuries = ONB_NO_INJURY_LABEL[lang];
  }
  userProfile.onboarded = true;
  saveJSON('rahafit_profile', userProfile);
  syncProfileToCloud();
}

function onbFinish(){
  onbApplyData();
  closeOnboarding();
  if(typeof scrollToChat === 'function') scrollToChat();
  const input = document.getElementById('chat-input');
  if(input) setTimeout(()=> input.focus(), 400);
}

function onbSkipAll(){
  userProfile.onboarded = true;
  saveJSON('rahafit_profile', userProfile);
  syncProfileToCloud();
  closeOnboarding();
}

function onbPrefillFromProfile(){
  const p = userProfile;
  if(p.age) document.getElementById('onb-age').value = p.age;
  if(p.gender) document.getElementById('onb-gender').value = p.gender;
  if(p.height) document.getElementById('onb-height').value = p.height;
  if(p.weight) document.getElementById('onb-weight').value = p.weight;
  // Re-select matching option cards by comparing stored label back to known keys.
  const lang = currentLang || 'ar';
  const selectByLabel = (containerId, labelMap, storedVal, field) => {
    const container = document.getElementById(containerId);
    if(!container || !storedVal) return;
    const entry = Object.entries(labelMap[lang]).find(([,label]) => label === storedVal);
    if(!entry) return;
    const btn = container.querySelector(`[data-value="${entry[0]}"]`);
    if(btn) onbSelectOption(field, btn);
  };
  selectByLabel('onb-goal-options', ONB_GOAL_LABEL, p.goal, 'goal');
  selectByLabel('onb-activity-options', ONB_ACTIVITY_LABEL, p.activityLevel, 'activityLevel');
  selectByLabel('onb-days-options', ONB_DAYS_LABEL, p.daysPerWeek, 'daysPerWeek');
  if(p.injuries && p.injuries !== ONB_NO_INJURY_LABEL.ar && p.injuries !== ONB_NO_INJURY_LABEL.en){
    const yesBtn = document.querySelector('#onb-injury-options [data-value="yes"]');
    if(yesBtn){ onbSelectInjury(yesBtn); document.getElementById('onb-injury-detail').value = p.injuries; }
  } else if(p.injuries){
    const noBtn = document.querySelector('#onb-injury-options [data-value="no"]');
    if(noBtn) onbSelectInjury(noBtn);
  }
}

function openOnboarding(isEdit){
  onbData = {};
  document.getElementById('onboarding-overlay').classList.add('open');
  if(isEdit){
    onbPrefillFromProfile();
    showOnbStep(1); // skip the welcome screen when re-editing
  } else {
    showOnbStep(0);
  }
}

function closeOnboarding(){
  document.getElementById('onboarding-overlay').classList.remove('open');
}
