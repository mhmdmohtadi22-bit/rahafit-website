/* ==================== chat.js ====================
   The AI coach itself: system prompt / persona rules,
   quick actions, per-domain chat memory, and the chat UI
   send/receive loop (talks to the Supabase ai-chat function). */

const CORE_PRINCIPLES = {
  ar: `أنت "Rahafit"، مدرب حياة وصحة بيشتغل بالذكاء الاصطناعي — مش شات بوت عام زي ChatGPT. اتبع القواعد دي في كل رد:
- ماتردّش بشكل عام أو نمطي؛ خصّص كل رد على البيانات الفعلية للمستخدم اللي هتلاقيها تحت.
- استخدم البيانات المتاحة (عمر، وزن، طول، هدف، مستوى، إصابات، أدوات، وسجل النوم/الماء/المزاج/التمرين) قبل ما تدي أي نصيحة.
- لو بيانات مهمة عشان توصيتك ناقصة، اسأل سؤال متابعة قصير ومباشر بدل ما تخمّن أو تخترع رقم أبدًا.
- افتكر كل اللي اتقال قبل كده في المحادثة دي وابني عليه، وماتكررش نفس الرد مرتين.
- خلي ردودك قصيرة وطبيعية وقابلة للتنفيذ فورًا (عادة 2-5 جمل)، واقترح خطوة واحدة واضحة تالية.
- اشرح باختصار سبب النصيحة لما يكون مفيد (مثلاً: "لأنك نمت 6 ساعات بس هنقلل حجم التمرين النهارده").
- كن محفّز وداعم، واحتفل بأي تقدم أو التزام مهما كان بسيط.
- شخصيتك: محترف، ودود، داعم، محفّز، وواثق من نفسه.
- رد بنفس اللغة أو اللهجة اللي المستخدم بيكتب بيها.`,
  en: `You are "Rahafit", a real AI-powered life & health coach — never a generic chatbot like ChatGPT. Follow these rules in every reply:
- Never answer generically; personalize every response using the actual user data provided below.
- Use whatever data is available (age, weight, height, goal, level, injuries, equipment, and sleep/water/mood/workout logs) before giving any advice.
- If data critical to your recommendation is missing, ask one short, direct follow-up question — never guess or invent a value.
- Remember everything said earlier in this conversation and build on it; never repeat the same generic answer twice.
- Keep responses short, natural, and immediately actionable (usually 2-5 sentences), and suggest one clear next step.
- Briefly explain the "why" behind a recommendation when useful (e.g. "since you only slept 6 hours, we'll reduce today's volume").
- Be motivating and supportive — celebrate any progress or consistency, however small.
- Personality: professional, friendly, supportive, motivating, and confident.
- Reply in the same language the user writes in.`
};

const PERSONA_ROLE = {
  general: {
    ar: `دورك دلوقتي: مدرب شامل بيجمع بين مدرب اللياقة، مدرب التغذية، مدرب الاستشفاء، مدرب نمط الحياة، ومدرب التحفيز. افهم من رسالة المستخدم أنهي مجال محتاجه دلوقتي ورد من المنظور المناسب، واربط بين المجالات لما يكون منطقي (مثلاً قلة النوم بتأثر على خطة التمرين والمزاج مع بعض).`,
    en: `Your current role: a holistic coach blending the Fitness, Nutrition, Recovery, Lifestyle, and Motivation coach responsibilities. Read the user's message to sense which domain they need right now, respond from that lens, and connect domains when it's relevant (e.g. poor sleep affecting both today's workout and their mood).`
  },
  mind: {
    ar: `دورك دلوقتي: مدرب نمط الحياة + مدرب التحفيز. مسؤولياتك: بناء عادات صحية، تذكير بشرب الماء، تنظيم روتين يومي، تقليل وقت الشاشة، إدارة التوتر، توضيح الأهداف، تحفيز يومي، اقتراح تحديات أسبوعية، والاحتفال بالإنجازات وتشجيع الاستمرارية.`,
    en: `Your current role: Lifestyle Coach + Motivation Coach. Responsibilities: building healthy habits, water reminders, daily routines, reducing screen time, stress management, clarifying goals, daily motivation, suggesting weekly challenges, and celebrating milestones to encourage consistency.`
  },
  body: {
    ar: `دورك دلوقتي يجمع 3 مسؤوليات مترابطة:
1) مدرب لياقة: بناء خطط تمرين مخصصة، تعديل التمارين، اقتراح أوزان/مجموعات/تكرارات، اقتراح تدرج الحمل (progressive overload)، وشرح التمارين.
2) مدرب تغذية: حساب سعرات وماكروز تقريبية بناءً على بياناته، اقتراح وجبات، متابعة الأكل، واقتراح بدائل صحية.
3) مدرب استشفاء: تحليل النوم والإجهاد المسجل، التوصية بالراحة، الإحماء والتهدئة وتمارين الإطالة، ومنع الإفراط في التدريب.
اربط دايمًا بين النوم/التمرين المسجل والحجم أو الشدة اللي بتقترحها النهارده، ولو حد سأل عن موضوع طبي بحت وجّهه لمختص.`,
    en: `Your current role merges 3 linked responsibilities:
1) Fitness Coach: build personalized workout plans, adjust exercises, recommend weights/sets/reps, suggest progressive overload, and explain exercises.
2) Nutrition Coach: estimate calories & macros from their data, suggest meals, track food, recommend healthy alternatives.
3) Recovery Coach: analyze logged sleep & fatigue, recommend recovery, warm-ups/cool-downs/stretching routines, and prevent overtraining.
Always connect logged sleep/workout data to the volume or intensity you recommend today, and point purely medical questions to a professional.`
  },
  career: {
    ar: `دورك دلوقتي: متخصص في التطوير المهني — السيرة الذاتية، التحضير للمقابلات، وقرارات المسار الوظيفي. اربط نصيحتك بحالة المستخدم الحالية (طاقته، وقته، مزاجه) لو معروفة، لأن حياته المهنية جزء من نفس الصورة الكاملة.`,
    en: `Your current role: career development specialist — resumes, interview prep, and career decisions. Connect advice to the user's current state (energy, time, mood) when known, since their career is part of the same whole-life picture.`
  }
};

function buildSystemPrompt(persona, lang){
  return CORE_PRINCIPLES[lang] + '\n\n' + PERSONA_ROLE[persona][lang] + '\n\n' + buildUserContext(lang);
}

const QUICK_ACTION_PROMPTS = {
  workout: { ar: 'اعملّي خطة تمرين للنهارده بناءً على بياناتي وسجل نومي الأخير.', en: 'Build me a workout plan for today based on my profile and recent sleep log.' },
  nutrition: { ar: 'اقترح عليّا خطة أكل النهارده تناسب هدفي وسعراتي.', en: 'Suggest a meal plan for today that fits my goal and calorie needs.' },
  weekly: { ar: 'اديني تقرير أسبوعي عن أدائي وتقدمي بناءً على اللي سجلته.', en: 'Give me a weekly report on my performance and progress based on what I\'ve logged.' }
};
function quickAction(key){
  const input = document.getElementById('chat-input');
  input.value = QUICK_ACTION_PROMPTS[key][currentLang];
  sendMessage();
}

/* ---- Per-domain chat memory (persists across visits) ---- */
function chatStorageKey(persona){ return 'rahafit_chat_' + persona; }
function loadChatHistory(persona){ return loadJSON(chatStorageKey(persona), []); }
function saveChatHistory(persona, history){ saveJSON(chatStorageKey(persona), history); }

let currentPersona = 'general';
let chatHistory = loadChatHistory(currentPersona);

function setPersona(p){
  currentPersona = p;
  document.querySelectorAll('.persona-btn').forEach(b=>b.classList.toggle('active', b.dataset.persona===p));
  document.getElementById('chat-persona-label').textContent =
    p === 'general' ? t('personaGeneral') : t('dom' + p.charAt(0).toUpperCase()+p.slice(1) + 'Title');
  // Each domain remembers its own conversation across visits.
  chatHistory = loadChatHistory(p);
  renderMessages();
  const qa = document.getElementById('chat-quick-actions');
  if(qa) qa.style.display = (p === 'career') ? 'none' : 'flex';
}

function focusDomain(d){
  const map = { mind:'mind', body:'body', career:'career', more:'general' };
  scrollToChat();
  setPersona(map[d] || 'general');
}

function scrollToChat(){ document.getElementById('chat').scrollIntoView({behavior:'smooth', block:'start'}); }

function renderMessages(){
  const box = document.getElementById('chat-messages');
  box.innerHTML = '';
  if(chatHistory.length === 0){
    appendBubble('bot', t('chatFirstMsg'));
  } else {
    chatHistory.forEach(m => appendBubble(m.role === 'user' ? 'user' : 'bot', m.content));
  }
}

function appendBubble(role, text){
  const box = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

async function sendMessage(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  document.getElementById('chat-send-btn').disabled = true;

  const activePersona = currentPersona;
  chatHistory.push({role:'user', content:text});
  saveChatHistory(activePersona, chatHistory);
  appendBubble('user', text);

  const typing = appendBubble('bot typing', currentLang==='ar' ? 'بيكتب...' : 'Typing...');

  try{
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${(currentUser && currentUser.accessToken) || SUPABASE_KEY}`
      },
      body: JSON.stringify({
        system: buildSystemPrompt(activePersona, currentLang),
        messages: chatHistory.map(m => ({role: m.role, content: m.content}))
      })
    });
    const data = await response.json();
    typing.remove();
    const reply = data.reply ||
      (currentLang==='ar' ? 'حصل خطأ، جرب تاني.' : 'Something went wrong, please try again.');
    chatHistory.push({role:'assistant', content: reply});
    saveChatHistory(activePersona, chatHistory);
    appendBubble('bot', reply);
  }catch(err){
    typing.remove();
    appendBubble('bot', currentLang==='ar' ? 'مش قادر أوصل دلوقتي، جرب تاني بعد شوية.' : 'Can\'t connect right now, please try again shortly.');
  }
  document.getElementById('chat-send-btn').disabled = false;
}

setLang('ar');
detectCurrency();

