export function createToast(el) {
  let timer = null;
  return function show(message) {
    el.textContent = message;
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      el.hidden = true;
    }, 4000);
  };
}