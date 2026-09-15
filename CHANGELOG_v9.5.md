# Webapp Studio CAI – Versione 9.5

**Data release:** 15 Settembre 2026 · **Base:** v9.4
**Tipo:** identità visiva

---

## Allineamento alle altre webapp dello studio

Segnalazioni era rimasta l'unica applicazione verde: usava `#15803d` e accenti
"emerald", mentre App Sinistri, Anagrafe Condominiale e le altre usano il
**bordeaux #8B1538** su fondo crema. Ora la palette è la stessa.

| Elemento | Prima | Ora |
|---|---|---|
| Colore di marca | `#15803d` verde | `#8B1538` bordeaux |
| Intestazione e pulsante | gradiente verde | gradiente bordeaux |
| Riquadri e riscontri | accenti emerald | accenti bordeaux |
| Fondo pagina | crema con aloni verdi | crema con aloni bordeaux |
| Ombre | verdi | bordeaux |
| Carattere principale | Geist, poi Manrope | **Manrope**, poi Geist |

Le tonalità scure dei gradienti non sono più fisse: vengono **calcolate dal colore
di marca**, così se un domani il colore venisse cambiato dalla configurazione
(`cm_primary`) l'intera interfaccia resta coerente senza toccare il codice.
Da `#8B1538` derivano `#6c102c` e `#560d23`.

Titoli in Fraunces e testo in Manrope, come nelle altre app.

Invariato l'avviso giallo sui doppioni: è un colore di segnalazione, non di marca.

---

## Invariato rispetto alla v9.4

Tutte le funzioni: pulizia dei campi, Scala e Interno con spazi e trattini, dati del
segnalante ricordati sul dispositivo, controllo doppioni, fino a 5 allegati,
titolo della scheda, allineamento dei riquadri, categorie, webhook, formato ticket.

File modificati rispetto alla v9.4: `src/App.js`, `src/index.css`,
`tailwind.config.js`, `package.json`.

---

## Stato lato Make (aggiornato al 15/09/2026)

- Iterator attivo: le foto multiple vengono caricate una per una nella cartella
  dell'intervento.
- Versione app inviata a ogni segnalazione e presente nell'email interna
  "Nuova segnalazione". Non registrata su Airtable: manca la colonna dedicata.
- Ordine del ramo interventi: cartella, scheda, link, foglio, Airtable, email alla
  ditta, caricamento foto, conferme Telegram.
- Nessun modulo su "Ignore": ogni errore blocca e resta visibile nelle esecuzioni
  incomplete, per scelta esplicita.

---

**Nota tecnica:** nessuna sequenza di escape `\uXXXX` nel sorgente.
`src/App.js` deve pesare esattamente **53.428 byte**.

**Versione:** 9.5 · **Data:** 15/09/2026
