import { formatDecimal, formatDuration } from '../format.js';

export function tollRows(ledgerState, showBill) {
  const km = ledgerState.tolledKmByClass;
  const rows = [
    { label: 'Úseky s mýtem', value: String(ledgerState.tolledSegments) },
    { label: 'Třída A', value: `${formatDecimal(km.A)} km`, tollClass: 'A' },
    { label: 'Třída B', value: `${formatDecimal(km.B)} km`, tollClass: 'B' },
    { label: 'Třída C', value: `${formatDecimal(km.C)} km`, tollClass: 'C' },
    { label: 'Celkem', value: `${formatDecimal(km.A + km.B + km.C)} km`, strong: true },
  ];
  if (showBill) rows.push({ label: 'Mýtné k úhradě', value: `${formatDecimal(ledgerState.bill)} Kč`, strong: true });
  return rows;
}

export function createDashboard(root) {
  root.innerHTML = '<h2>Jízda</h2><dl class="details"></dl>';
  root.hidden = true;
  const list = root.querySelector('dl');

  return {
    update({ distanceKm, totalKm, simMs, ledger, showBill }) {
      root.hidden = false;
      const rows = [
        { label: 'Ujeto', value: `${formatDecimal(distanceKm)} / ${formatDecimal(totalKm)} km` },
        { label: 'Simulovaný čas', value: formatDuration(simMs) },
        ...tollRows(ledger, showBill),
      ];
      list.innerHTML = rows.map(({ label, value }) => `<dt>${label}</dt><dd>${value}</dd>`).join('');
    },
    clear() {
      root.hidden = true;
    },
  };
}