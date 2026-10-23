import { RATE_MAX, RATE_MIN, TOLL_CLASSES } from '../config.js';
import { validateRates } from '../tolls/rates.js';

export function createTollPanel(root, settings, { onRatesChange, notify }) {
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
    <h3>Ceny (Kč/km)</h3>
    ${TOLL_CLASSES.map((tollClass) => `<label class="inline rate">Třída ${tollClass} <input type="number" name="rate${tollClass}" min="${RATE_MIN}" max="${RATE_MAX}" step="1"></label>`).join('')}
  `;

  const modeInputs = root.querySelectorAll('input[name="mode"]');
  const typeEl = root.querySelector('select[name="type"]');
  const fromEl = root.querySelector('input[name="validFrom"]');
  const untilEl = root.querySelector('input[name="validUntil"]');
  const rateInputs = Object.fromEntries(TOLL_CLASSES.map((tollClass) => [tollClass, root.querySelector(`input[name="rate${tollClass}"]`)]));

  let locked = false;

  function render() {
    for (const input of modeInputs) {
      input.checked = input.value === settings.mode;
      input.disabled = locked;
    }
    typeEl.value = settings.type;
    fromEl.value = toInputValue(settings.validFrom);
    untilEl.value = toInputValue(settings.validUntil);
    const subscriptionDisabled = locked || settings.mode !== 'subscription';
    typeEl.disabled = subscriptionDisabled;
    fromEl.disabled = subscriptionDisabled;
    untilEl.disabled = subscriptionDisabled;
    syncRates();
  }

  function syncRates() {
    for (const tollClass of TOLL_CLASSES) {
      rateInputs[tollClass].value = settings.rates[tollClass];
      rateInputs[tollClass].disabled = locked;
    }
  }

  function clampRate(tollClass, rate) {
    const index = TOLL_CLASSES.indexOf(tollClass);
    const lower = index === 0 ? RATE_MIN : settings.rates[TOLL_CLASSES[index - 1]] + 1;
    const upper = index === TOLL_CLASSES.length - 1 ? RATE_MAX : settings.rates[TOLL_CLASSES[index + 1]] - 1;
    return Math.min(upper, Math.max(lower, rate));
  }

  function changeRate(tollClass) {
    const requested = Math.round(rateInputs[tollClass].valueAsNumber);
    const error = validateRates({ ...settings.rates, [tollClass]: requested });
    const applied = Number.isNaN(requested) ? settings.rates[tollClass] : clampRate(tollClass, requested);
    if (error !== null) {
      const hint = Number.isNaN(requested) ? '' : ` Nastavena ${requested > applied ? 'nejvyšší' : 'nejnižší'} možná hodnota: ${applied} Kč/km.`;
      notify(`${error}${hint}`, 'caution');
    }
    settings.rates = { ...settings.rates, [tollClass]: applied };
    onRatesChange();
    syncRates();
  }

  root.addEventListener('change', ({ target }) => {
    if (target.name?.startsWith('rate')) {
      changeRate(target.name.slice(4));
      return;
    }
    if (target.name === 'mode') settings.mode = target.value;
    else if (target.name === 'type') settings.type = target.value;
    else if (target.name === 'validFrom' && !Number.isNaN(Date.parse(target.value))) settings.validFrom = Date.parse(target.value);
    else if (target.name === 'validUntil' && !Number.isNaN(Date.parse(target.value))) settings.validUntil = Date.parse(target.value);
    render();
  });

  render();

  return {
    setLocked(value) {
      locked = value;
      render();
    },
  };
}

function toInputValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
