# Webapp Studio CAI – Versione 9.3

**Data release:** 14 Settembre 2026
**Base:** v9.2
**Tipo:** correttiva (interfaccia)

---

## 1. Titolo della scheda del browser

Prima era fisso in `public/index.html` e riportava ancora "Studio CAI – Segnalazioni · v9.0",
quindi restava indietro a ogni nuova versione pubblicata.

Ora il titolo è impostato dalla webapp stessa ed è **"Segnalazioni – Studio CAI"**,
senza numero di versione. La versione resta visibile dove serve: nel badge in alto
accanto al nome dello studio e nel footer.

Effetto collaterale utile: `public/index.html` non va più aggiornato a mano.

## 2. Allineamento dei riquadri delle categorie

I riquadri sono elementi `button`. Quando il contenuto è più corto dell'altezza del
riquadro, il browser lo centra verticalmente di sua iniziativa: per questo nelle card
con titolo su una riga (Amministrativa, Contabile, Appuntamento, Invio Documenti)
icona e testo apparivano più in basso rispetto a quelle con titolo su due righe
(Interventi di Manutenzione, Richiesta di Documentazione).

Due correzioni:

- il riquadro diventa una colonna flex ancorata in alto, così il contenuto non viene
  più centrato e tutte le icone della stessa riga sono allineate;
- il titolo ha un'altezza minima pari a due righe, così anche le descrizioni partono
  tutte dalla stessa quota.

---

## Invariato rispetto alla v9.2

Scala e Interno con spazi, trattino, barra e punto; foto facoltativa negli interventi
di manutenzione; pulizia finale dei campi; categorie, webhook, formato ticket,
cooldown, privacy.

File modificati rispetto alla v9.2: `src/App.js`, `package.json`.
Tutti gli altri file, compresa la cartella `public/` con logo e `index.html`,
sono presenti in questa cartella: è completa e pronta da pubblicare così com'è.

---

**Versione:** 9.3
**Data:** 14/09/2026
