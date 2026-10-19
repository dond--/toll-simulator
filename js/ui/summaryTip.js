export function createSummaryTip(anchor) {
  const tip = document.createElement('div');
  tip.className = 'summary-tip';
  tip.hidden = true;
  document.body.append(tip);

  let rows = null;
  let hovered = false;

  function render() {
    const heading = document.createElement('h3');
    heading.textContent = 'Souhrn mýtného';
    const lines = rows.map(({ label, value, tollClass, strong }) => {
      const line = document.createElement('div');
      line.className = strong ? 'summary-tip-row strong' : 'summary-tip-row';
      const name = document.createElement('span');
      name.className = 'summary-tip-label';
      if (tollClass) {
        const swatch = document.createElement('i');
        swatch.className = `swatch toll-${tollClass.toLowerCase()}`;
        name.append(swatch);
      }
      name.append(label);
      const amount = document.createElement('span');
      amount.className = 'summary-tip-value';
      amount.textContent = value;
      line.append(name, amount);
      return line;
    });
    tip.replaceChildren(heading, ...lines);
  }

  function show() {
    render();
    const box = anchor.getBoundingClientRect();
    tip.style.left = `${box.left}px`;
    tip.style.top = `${box.bottom + 6}px`;
    tip.hidden = false;
  }

  anchor.addEventListener('mouseenter', () => {
    hovered = true;
    if (rows) show();
  });
  anchor.addEventListener('mouseleave', () => {
    hovered = false;
    tip.hidden = true;
  });

  return {
    set(newRows) {
      rows = newRows;
      if (hovered) show();
    },
    clear() {
      rows = null;
      tip.hidden = true;
    },
  };
}