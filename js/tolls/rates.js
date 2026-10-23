import { RATE_MAX, RATE_MIN, TOLL_CLASSES } from '../config.js';

export function validateRates(rates) {
  for (const tollClass of TOLL_CLASSES) {
    const rate = rates[tollClass];
    if (!Number.isInteger(rate) || rate < RATE_MIN || rate > RATE_MAX) {
      return `Cena třídy ${tollClass} musí být celé číslo od ${RATE_MIN} do ${RATE_MAX} Kč/km.`;
    }
  }
  for (let i = 1; i < TOLL_CLASSES.length; i++) {
    const lower = TOLL_CLASSES[i - 1];
    const higher = TOLL_CLASSES[i];
    if (rates[higher] <= rates[lower]) {
      return `Cena třídy ${lower} musí být nižší než cena třídy ${higher}.`;
    }
  }
  return null;
}

export function tollClassLabel(tollClass, rate) {
  return `Třída ${tollClass} (${rate} Kč/km)`;
}
