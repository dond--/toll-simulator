# Plán: editovatelné ceny tříd mýtného

Stav: schváleno, neimplementováno.

## Cíl

Uživatel může změnit cenu (Kč/km) každé ze tří tříd mýtného A, B, C. Změna se projeví až při příští jízdě.

## Rozhodnutí

- Počet tříd zůstává 3.
- Ceny jsou celá čísla Kč/km, minimum **1**, maximum **1000** pro každou třídu. Výchozí hodnoty zůstávají A = 1, B = 10, C = 100.
- Pořadí A < B < C se vynucuje při zadání. Neplatná hodnota se odmítne, zobrazí se krátká hláška a pole se vrátí k poslední platné hodnotě. Sousední třídy se automaticky neposouvají.
- Ceny se ovládají v panelu Mýtné (`#toll-panel`) v nové sekci „Ceny (Kč/km)“ se třemi číselnými poli.
- Pole jsou aktivní vždy, i v režimu předplatného. Ceny se použijí jen v režimu „Platba za km“.
- Ceny se neukládají mezi načteními stránky. Po načtení se vrací na výchozí hodnoty.
- Ceny se zamykají během jízdy stejně jako ostatní nastavení mýtného (`setLocked`).

## Současný stav kódu

- `js/config.js:3` – `TOLL_RATES = { A: 1, B: 10, C: 100 }`, konstanta.
- `js/tolls/ledger.js:1,19` – `TOLL_RATES` se importuje a čte při každém vstupu do úseku. Bez úpravy by se změna projevila i v běžící jízdě.
- `index.html:33–35` – ceny jsou napevno v textu legendy.
- `js/ui/tripController.js` – `tripSettings = { ...settings }` je mělká kopie. Objekt `rates` by byl sdílený, proto se musí kopírovat zvlášť.

## Postup implementace

1. **`js/config.js`**
   - Ponechat `TOLL_RATES` jako výchozí hodnoty.
   - Přidat `RATE_MIN = 1` a `RATE_MAX = 1000`.

2. **`js/tolls/rates.js` (nový soubor)**
   - Čistá funkce `validateRates(rates)`, která vrací chybovou zprávu nebo `null`.
   - Kontroluje celá čísla, rozsah `[RATE_MIN, RATE_MAX]` a pořadí A < B < C.
   - Funkce nemá žádné závislosti na DOM, takže jde otestovat samostatně.

3. **`js/main.js`**
   - Inicializovat `settings.rates` kopií výchozích cen, např. `{ ...TOLL_RATES }`.

4. **`js/ui/tollPanel.js`**
   - Přidat sekci „Ceny (Kč/km)“ se třemi `input type="number"` (`name="rateA"`, `rateB`, `rateC`, `min`/`max`/`step="1"`).
   - Při `change` zavolat `validateRates` nad kandidátními hodnotami.
   - Pokud je validace chybná, zobrazit hlášku a vrátit pole k hodnotám z `settings.rates`.
   - Pokud je validace v pořádku, zapsat do `settings.rates`.
   - V `render()` synchronizovat pole s `settings.rates`.
   - Při zamčení (`setLocked`) pole zakázat.

5. **`js/tolls/ledger.js`**
   - Odstranit import `TOLL_RATES`.
   - Přijímat `rates` jako parametr v `createTollLedger` a používat `rates[tollClass]`.

6. **`js/ui/tripController.js`**
   - V `run()` vytvořit snapshot: `tripSettings = { ...settings, rates: { ...settings.rates } }`.
   - Předat `tripSettings.rates` do `createTollLedger`.
   - Tím se změna projeví až při příští jízdě.

7. **Legenda (`index.html` a `js/main.js` nebo `js/ui/`)**
   - Odstranit napevno psané „(1 Kč/km)“ atd.
   - Texty legendy generovat z `settings.rates` při startu a při každé úspěšné změně ceny.

8. **Souhrn a dashboard**
   - Beze změny. Čerpají z `ledger.state.bill` a `tolledKmByClass`.

## Testy

- Jednotkové testy pro `validateRates` v `tests/`:
  - hodnoty 0, záporné, neceločíselné a nad 1000 jsou odmítnuty,
  - pořadí A < B < C je vynuceno,
  - platná konfigurace projde.
- Test ledgeru: při `postFactum` se účtuje podle předaných `rates`, nikoli podle konstant.
- Test snapshotu: změna `settings.rates` během jízdy nemění účtování běžící jízdy.
- Ruční ověření v prohlížeči:
  - změna ceny se projeví v legendě,
  - neplatná hodnota se odmítne a hláška se zobrazí,
  - pole jsou během jízdy zamknutá,
  - nová jízda používá novou cenu,
  - po načtení stránky jsou ceny zpět na výchozí.

## Mimo rozsah

- Ukládání cen do `localStorage`.
- Změna počtu tříd.
- Desetinné ceny.
