/* ==================== ui.js ====================
   Currency detection/formatting for pricing, generic scroll
   helpers, and the scroll-reveal entrance animation. */

const CURRENCY_MAP = {
  EG: { code:'EGP', rate:49,   symAr:'ج.م', symEn:'EGP' },
  SA: { code:'SAR', rate:3.75, symAr:'ر.س', symEn:'SAR' },
  AE: { code:'AED', rate:3.67, symAr:'د.إ', symEn:'AED' },
  KW: { code:'KWD', rate:0.31, symAr:'د.ك', symEn:'KWD' },
  QA: { code:'QAR', rate:3.64, symAr:'ر.ق', symEn:'QAR' },
  BH: { code:'BHD', rate:0.38, symAr:'د.ب', symEn:'BHD' },
  OM: { code:'OMR', rate:0.38, symAr:'ر.ع', symEn:'OMR' },
  JO: { code:'JOD', rate:0.71, symAr:'د.أ', symEn:'JOD' },
  US: { code:'USD', rate:1,    symAr:'$',   symEn:'$'   }
};
const PRO_BASE_USD = 14.99;
let currentCurrency = CURRENCY_MAP.US;

function formatPrice(usdAmount){
  const c = currentCurrency;
  const raw = usdAmount * c.rate;
  const amount = raw >= 10 ? Math.round(raw) : Math.round(raw * 100) / 100;
  const symbol = currentLang === 'ar' ? c.symAr : c.symEn;
  return currentLang === 'ar' ? `${amount} ${symbol}` : (c.code === 'USD' ? `${symbol}${amount}` : `${amount} ${symbol}`);
}

function renderPrices(){
  const freeEl = document.getElementById('price-free-amount');
  const proEl = document.getElementById('price-pro-amount');
  const perMonth = currentLang === 'ar' ? '/شهرياً' : '/mo';
  if(freeEl) freeEl.textContent = formatPrice(0);
  if(proEl) proEl.textContent = formatPrice(PRO_BASE_USD) + perMonth;
}

async function detectCurrency(){
  renderPrices(); // show USD immediately while detecting
  try{
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    currentCurrency = CURRENCY_MAP[data.country_code] || CURRENCY_MAP.US;
  }catch(e){
    currentCurrency = CURRENCY_MAP.US;
  }
  renderPrices();
}


function scrollToId(id){ document.getElementById(id).scrollIntoView({behavior:'smooth', block:'start'}); }

(function initScrollReveal(){
  const targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if(!targets.length) return;

  if(!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    targets.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  targets.forEach(el => io.observe(el));
})();
