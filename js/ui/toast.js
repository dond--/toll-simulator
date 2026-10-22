export function createToast(el) {
  let timer = null;
  return function show(message, tone) {
    el.textContent = message;
    el.dataset.tone = tone;
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      el.hidden = true;
    }, 4000);
  };
}