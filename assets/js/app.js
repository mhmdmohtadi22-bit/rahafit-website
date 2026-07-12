/* ==================== app.js ====================
   Entry point: wires up global listeners and kicks off the
   app once every other module has loaded. Keep this file
   loaded LAST in index.html. */

document.addEventListener('keydown', e => { if(e.key === 'Escape') closeAuth(); });


setLang('ar');
detectCurrency();
