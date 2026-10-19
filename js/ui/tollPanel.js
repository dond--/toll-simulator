export function createTollPanel(root, settings) {
  root.innerHTML = `
    <h2>Mýtné</h2>
    <label class="inline"><input type="radio" name="mode" value="subscription"> Předplatné</label>
    <label class="inline"><input type="radio" name="mode" value="postFactum"> Platba za km</label>
    <label>Typ předplatného
      <select name="type">
        <option value="A">A (pokrývá A)</option>
        <option value="B">B (pokrývá A, B)</option>
        <option value="C">C (pokrývá A, B, C)</option>
      </select>
    </label>
    <label>Platí od <input type="datetime-local" name="validFrom"></label>
    <label>Platí do <input type="datetime-local" name="validUntil"></label>
    <p class="hint">Změny platí pro další jízdu.</p>
  `;

  const modeInputs = root.querySelectorAll('input[name="mode"]');
  const typeEl = root.querySelector('select[name="type"]');
  const fromEl = root.querySelector('input[name="validFrom"]');
  const untilEl = root.querySelector('input[name="validUntil"]');

  function render() {
    for (const input of modeInputs) input.checked = input.value === settings.mode;
    typeEl.value = settings.type;
    fromEl.value = toInputValue(settings.validFrom);
    untilEl.value = toInputValue(settings.validUntil);
    const subscription = settings.mode === 'subscription';
    typeEl.disabled = !subscription;
    fromEl.disabled = !subscription;
    untilEl.disabled = !subscription;
  }

  root.addEventListener('change', ({ target }) => {
    if (target.name === 'mode') settings.mode = target.value;
    else if (target.name === 'type') settings.type = target.value;
    else if (target.name === 'validFrom' && !Number.isNaN(Date.parse(target.value))) settings.validFrom = Date.parse(target.value);
    else if (target.name === 'validUntil' && !Number.isNaN(Date.parse(target.value))) settings.validUntil = Date.parse(target.value);
    render();
  });

  render();
}

function toInputValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}