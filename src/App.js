import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, CheckCircle2, AlertCircle, Building2, Mail, Phone, Shield, Loader2,
  ChevronDown, Paperclip, X, Info, FileText, User, MapPin, Sparkles, Lock,
  Hash, Home, Users, Wrench, Calendar, ClipboardList
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Build constants (v9.3)
// ─────────────────────────────────────────────────────────────
const APP_VERSION = "9.3";
const BUILD_DATE_LABEL = "14/09/2026"; // Data fissa della release, non cambia ogni giorno

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const cn = (...cls) => cls.filter(Boolean).join(" ");
const load = (k, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(k) || ""); return v ?? fallback; } catch { return fallback; }
};

// Input sanitization – rimuove i simboli non ammessi nei campi specificati.
// Si applica on-change, così l'utente non può mai digitare caratteri indesiderati.
const sanitizers = {
  // Condominio: lettere (anche accentate), numeri, spazi, virgola, punto, apostrofo, trattino
  condominio: (v) => v.replace(/[^\p{L}\p{N}\s.,'-]/gu, ""),
  // Scala: lettere, numeri, spazi, trattino, barra e punto.
  // v9.2: prima era solo alfanumerico e valori reali come "A 1-1", "B1/2" o "28 Por."
  // venivano storpiati in "A11", "B12", "28Por".
  scala: (v) => v.replace(/[^\p{L}\p{N}\s./-]/gu, ""),
  // Interno: stessa regola della scala (v9.2)
  interno: (v) => v.replace(/[^\p{L}\p{N}\s./-]/gu, ""),
  // Nome e Cognome: solo lettere, spazi, apostrofo e trattino (consente D'Angelo, De-Luca, accenti)
  nome: (v) => v.replace(/[^\p{L}\s'-]/gu, ""),
  // Telefono: cifre, spazi e "+" (per prefisso internazionale)
  telefono: (v) => v.replace(/[^\d\s+]/g, ""),
};

// Pulizia finale (v9.1) – applicata all'uscita dal campo (onBlur) e, comunque, prima dell'invio.
// Durante la digitazione gli spazi restano liberi (altrimenti non si potrebbe scrivere "Via Roma");
// qui si eliminano spazi iniziali/finali, spazi doppi, a capo e punteggiatura in coda.
// Motivo: il nome della cartella Dropbox creata da Make è "TICKET - Condominio" e Dropbox
// rifiuta i nomi che terminano con spazio o punto (errore 409 path/malformed_path).
const squash = (v) => String(v ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
const finalizers = {
  // "Via San Remo 1 " → "Via San Remo 1" · "Via Roma 12." → "Via Roma 12" · "  Da  Como " → "Da Como"
  condominio: (v) => squash(v).replace(/^[\s.,'-]+|[\s.,'-]+$/g, ""),
  // Scala e Interno: solo spazi superflui. Non si tocca la punteggiatura,
  // perché valori come "28 Por." sono legittimi e non finiscono in un path Dropbox.
  scala: (v) => squash(v),
  interno: (v) => squash(v),
  nome: (v) => squash(v).replace(/^[\s'-]+|[\s'-]+$/g, ""),
  // L'email non può contenere spazi: si eliminano tutti (la tastiera del telefono ne aggiunge spesso uno in coda)
  email: (v) => String(v ?? "").replace(/\s+/g, "").toLowerCase(),
  telefono: (v) => squash(v),
  // Messaggio: si conservano gli a capo interni, si tolgono solo spazi/righe vuote all'inizio e alla fine
  messaggio: (v) => String(v ?? "").normalize("NFC").replace(/[ \t]+\n/g, "\n").trim(),
};
const finalizeValue = (k, v) => (finalizers[k] && typeof v === "string" ? finalizers[k](v) : v);
const finalizeForm = (f) => {
  const out = { ...f };
  Object.keys(finalizers).forEach((k) => { out[k] = finalizeValue(k, out[k]); });
  return out;
};

export default function CondoMessenger() {
  // Brand / theme / endpoint
  const [brandName] = useState(load("cm_brand", "Studio CAI"));
  const [logoUrl] = useState(load("cm_logo", "/logo.jpg"));
  const [primary] = useState(load("cm_primary", "#15803d"));
  const [webhook] = useState(() => {
    const v = load("cm_webhook", "https://hook.eu1.make.com/xvuih8pqxk96q9v6bjpls6u8e4k4f5qv");
    return v === "https://hook.eu1.make.com/b2z7y28x5nyinnq0i5h6o9l14166paf3" ? "https://hook.eu1.make.com/xvuih8pqxk96q9v6bjpls6u8e4k4f5qv" : v;
  });

  // Form
  const [form, setForm] = useState({
    condominio: "", scala: "", interno: "",
    nome: "", email: "", telefono: "",
    categoria: "", subcategoria: "",
    messaggio: "", consenso: false,
    file: null
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [touched, setTouched] = useState({});
  const [showInfo, setShowInfo] = useState(false);

  // Titolo della scheda del browser (v9.3).
  // Prima stava fisso in public/index.html e riportava ancora "v9.0":
  // impostandolo qui non può più restare indietro rispetto alla versione pubblicata.
  React.useEffect(() => {
    document.title = `Segnalazioni \u2013 ${brandName}`;
  }, [brandName]);

  React.useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const cssVars = useMemo(() => ({ "--brand": primary }), [primary]);

  // Aggiornamento con sanificazione automatica
  const update = (k, v) => {
    const clean = sanitizers[k] ? sanitizers[k](v) : v;
    setForm((s) => ({ ...s, [k]: clean }));
    setTouched((t) => ({ ...t, [k]: true }));
  };

  // Pulizia finale del singolo campo quando l'utente ne esce (v9.1)
  const finalizeField = (k) => {
    setForm((s) => ({ ...s, [k]: finalizeValue(k, s[k]) }));
    setTouched((t) => ({ ...t, [k]: true }));
  };

  const getFieldError = (field) => {
    if (!touched[field]) return null;
    const v = finalizeValue(field, form[field]);
    switch (field) {
      case "condominio":
        return !v ? "Campo obbligatorio" :
               v.length < 3 ? "Indirizzo troppo breve" : null;
      case "nome":
        return !v ? "Campo obbligatorio" :
               v.length < 2 ? "Nome troppo breve" : null;
      case "email":
        return !v ? "Campo obbligatorio" :
               !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Email non valida" : null;
      case "telefono":
        return !v ? "Campo obbligatorio" :
               v.replace(/\D/g, "").length < 6 ? "Numero troppo breve" : null;
      case "categoria":
        return !form.categoria ? "Seleziona una categoria" : null;
      case "subcategoria":
        if (form.categoria === "Interventi di Manutenzione" || form.categoria === "Invio Documenti") {
          return !form.subcategoria ? "Campo obbligatorio" : null;
        }
        return null;
      case "messaggio":
        return !v ? "Campo obbligatorio" :
               v.length < 3 ? "Messaggio troppo breve (min. 3 caratteri)" : null;
      default:
        return null;
    }
  };

  // La validazione lavora sempre sui valori già ripuliti
  const validate = (f) => {
    const errs = [];
    if (!f.condominio) errs.push("Indica il condominio");
    if (f.condominio && f.condominio.length < 3) errs.push("Indirizzo del condominio troppo breve");
    if (!f.nome) errs.push("Inserisci il tuo nome");
    if (f.nome && f.nome.length < 2) errs.push("Nome troppo breve");
    if (!f.email) errs.push("Inserisci la tua email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.push("Email non valida");
    if (!f.telefono) errs.push("Inserisci il tuo telefono");
    if (f.telefono && f.telefono.replace(/\D/g, "").length < 6) errs.push("Numero di telefono troppo breve");
    if (!f.categoria) errs.push("Seleziona una categoria");
    if (f.categoria === "Interventi di Manutenzione" && !f.subcategoria) errs.push("Seleziona una sottocategoria di manutenzione");
    if (f.categoria === "Invio Documenti" && !f.subcategoria) errs.push("Seleziona il tipo di documento");
    if (!f.messaggio || f.messaggio.length < 3) errs.push("Messaggio troppo breve");
    if (!f.consenso) errs.push("Accetta l'informativa privacy");

    // Per "Invio Documenti" l'allegato resta obbligatorio.
    // Per "Interventi di Manutenzione" (v9.2) è facoltativo, ma se c'è va comunque validato.
    if (f.categoria === "Invio Documenti" && !f.file) errs.push("Carica un file");
    if (f.file && !/\.(pdf|jpg|jpeg|png)$/i.test(f.file.name)) errs.push("Sono ammessi solo PDF o immagini (jpg, jpeg, png)");
    if (f.file && f.file.size > 10 * 1024 * 1024) errs.push("Il file supera i 10 MB");
    return errs;
  };

  const submit = async () => {
    if (cooldown) return;

    setTouched({
      condominio: true, nome: true, email: true, telefono: true,
      categoria: true, subcategoria: true, messaggio: true
    });

    // Pulizia finale di tutti i campi prima di validare e inviare
    const clean = finalizeForm(form);
    setForm(clean);

    const errs = validate(clean);
    if (errs.length) {
      setResult({ ok: false, error: errs[0] });
      return;
    }

    setSending(true);
    setResult(null);
    const ticket = `CM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    try {
      const fd = new FormData();
      const payload = { ...clean, ticket, timestamp: new Date().toISOString(), appVersion: APP_VERSION };
      Object.entries(payload).forEach(([k, v]) => { if (k !== "file") fd.append(k, String(v)); });
      if (clean.file) fd.append("file1", clean.file, clean.file.name);

      const res = await fetch(webhook, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Errore invio: ${res.status}`);

      setResult({ ok: true, ticket });
      setCooldown(8);
      setForm((s) => ({ ...s, categoria: "", subcategoria: "", messaggio: "", file: null, consenso: s.consenso }));
      setTouched({});
      // Torna verso l'alto per mostrare la conferma
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setResult({ ok: false, error: e.message || "Invio non riuscito. Riprova." });
    } finally {
      setSending(false);
    }
  };

  const categorie = [
    { value: "Interventi di Manutenzione", icon: Wrench, desc: "Segnala necessità di manutenzione", primary: true },
    { value: "Amministrativa", icon: ClipboardList, desc: "Questioni amministrative e gestionali" },
    { value: "Contabile", icon: FileText, desc: "Contabilità e bilanci" },
    { value: "Richiesta di Documentazione", icon: FileText, desc: "Richiedi documenti condominiali" },
    { value: "Appuntamento", icon: Calendar, desc: "Richiedi un appuntamento" },
    { value: "Invio Documenti", icon: Paperclip, desc: "Invia documenti, foto o autoletture" }
  ];

  const subCategorieManut = [
    "Antennista", "Ascensore", "Cancelli Elettrici", "Disinfestazioni/Derattizzazioni",
    "Edilizia", "Elettricista", "Fabbro", "Giardinaggio", "Idraulico",
    "Impianto di Riscaldamento", "Montascale"
  ];

  const subCategorieDoc = ["Documenti PDF", "Foto", "Autoletture dei contatori"];

  return (
    <div className="relative min-h-screen w-full bg-paper bg-noise text-neutral-900" style={cssVars}>
      {/* Decorative corner ornaments */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[var(--brand)]/10 blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-emerald-300/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 sticky top-0 bg-white/75 backdrop-blur-xl border-b border-neutral-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white ring-1 ring-neutral-200 shadow-soft flex items-center justify-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-8 h-8 text-[var(--brand)]" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--brand)] ring-2 ring-white flex items-center justify-center">
                <Shield className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-semibold text-xl sm:text-2xl text-neutral-900 truncate">{brandName}</h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white tracking-wider">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">Sportello digitale segnalazioni condominiali</p>
            </div>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2.5 rounded-xl hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
              aria-label="Informazioni"
            >
              <Info className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Info Panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative z-10 bg-gradient-to-b from-emerald-50 to-emerald-50/50 border-b border-emerald-200"
          >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Info className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-emerald-900 mb-1">Come funziona</p>
                  <p className="text-emerald-800/80">
                    Compila il modulo con i tuoi dati e la segnalazione. Riceverai un numero
                    di ticket univoco per tracciare la richiesta. Ti risponderemo al più presto.
                  </p>
                </div>
                <button onClick={() => setShowInfo(false)} className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-emerald-700" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero intro */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 backdrop-blur ring-1 ring-neutral-200 text-xs font-medium text-neutral-700 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[var(--brand)]" />
            Comunicazione rapida con il tuo amministratore
          </div>
          <h2 className="font-display text-3xl sm:text-5xl font-semibold text-neutral-900 leading-[1.05] tracking-tight">
            Come possiamo <em className="not-italic text-[var(--brand)]">aiutarti</em>?
          </h2>
          <p className="mt-4 text-neutral-600 text-base sm:text-lg">
            Compila il modulo qui sotto. Riceverai un numero ticket per seguire la tua richiesta.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-600">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-neutral-200">
              <Lock className="w-3 h-3" /> Dati protetti
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-neutral-200">
              <Hash className="w-3 h-3" /> Ticket tracciabile
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-neutral-200">
              <Shield className="w-3 h-3" /> GDPR compliant
            </span>
          </div>
        </motion.div>
      </section>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <motion.div
          layout
          className="bg-white rounded-3xl shadow-lift overflow-hidden ring-1 ring-neutral-200/80"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Card header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[var(--brand)] via-emerald-600 to-emerald-700 px-6 sm:px-8 py-6">
            <div aria-hidden="true" className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)",
                backgroundSize: "32px 32px",
                backgroundPosition: "0 0, 16px 16px"
              }}
            />
            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-semibold text-xl sm:text-2xl text-white leading-tight">Invia la tua segnalazione</h2>
                <p className="text-white/85 text-sm mt-1">Tutti i campi contrassegnati con <span className="font-semibold">*</span> sono obbligatori</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">

            {/* ─── Section: Dati Immobile ─── */}
            <FormSection
              stepNumber={1}
              icon={<Home className="w-4 h-4" />}
              title="Dati immobile"
              description="Dove si trova l'unità di cui stai segnalando?"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <TextField
                    label="Condominio"
                    placeholder="Es. Via Roma 23"
                    value={form.condominio}
                    onChange={(v) => update("condominio", v)}
                    onBlur={() => finalizeField("condominio")}
                    icon={<MapPin className="w-4 h-4" />}
                    error={getFieldError("condominio")}
                    hint="Indirizzo o nome dello stabile"
                    required
                  />
                </div>
                <TextField
                  label="Scala"
                  placeholder="Es. A"
                  value={form.scala}
                  onChange={(v) => update("scala", v)}
                  onBlur={() => finalizeField("scala")}
                  hint="Lettera o numero"
                />
                <TextField
                  label="Interno"
                  placeholder="Es. 12"
                  value={form.interno}
                  onChange={(v) => update("interno", v)}
                  onBlur={() => finalizeField("interno")}
                  hint="Numero o sigla"
                />
              </div>
            </FormSection>

            {/* ─── Section: Dati Personali ─── */}
            <FormSection
              stepNumber={2}
              icon={<Users className="w-4 h-4" />}
              title="Dati personali"
              description="Come possiamo ricontattarti?"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <TextField
                    label="Nome e Cognome"
                    placeholder="Es. Mario Rossi"
                    value={form.nome}
                    onChange={(v) => update("nome", v)}
                    onBlur={() => finalizeField("nome")}
                    icon={<User className="w-4 h-4" />}
                    error={getFieldError("nome")}
                    required
                  />
                </div>
                <TextField
                  label="Email"
                  type="email"
                  placeholder="nome@email.it"
                  value={form.email}
                  onChange={(v) => update("email", v)}
                  onBlur={() => finalizeField("email")}
                  icon={<Mail className="w-4 h-4" />}
                  error={getFieldError("email")}
                  required
                />
                <TextField
                  label="Telefono"
                  placeholder="Es. 333 123 4567"
                  value={form.telefono}
                  onChange={(v) => update("telefono", v)}
                  onBlur={() => finalizeField("telefono")}
                  icon={<Phone className="w-4 h-4" />}
                  error={getFieldError("telefono")}
                  required
                />
              </div>
            </FormSection>

            {/* ─── Section: Categoria ─── */}
            <FormSection
              stepNumber={3}
              icon={<ClipboardList className="w-4 h-4" />}
              title="Tipo di segnalazione"
              description="Scegli la categoria più adatta alla tua richiesta"
            >
              <CategoryGrid
                categories={categorie}
                selected={form.categoria}
                onSelect={(v) => {
                  update("categoria", v);
                  // Le categorie senza sottocategoria non prevedono allegati: si azzera tutto.
                  if (v !== "Interventi di Manutenzione" && v !== "Invio Documenti") {
                    setForm(s => ({ ...s, subcategoria: "", file: null }));
                  } else {
                    setForm(s => ({ ...s, subcategoria: "" }));
                  }
                }}
              />

              <AnimatePresence>
                {form.categoria === "Interventi di Manutenzione" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-5"
                  >
                    <SelectField
                      label="Tipo di intervento"
                      value={form.subcategoria}
                      onChange={(v) => update("subcategoria", v)}
                      options={subCategorieManut}
                      error={getFieldError("subcategoria")}
                      required
                    />
                    {/* v9.2 – foto facoltativa: aiuta il tecnico a capire il problema prima di uscire */}
                    <div className="mt-4">
                      <FileUpload
                        file={form.file}
                        onChange={(f) => update("file", f)}
                        onRemove={() => update("file", null)}
                        label="Foto o documento"
                        required={false}
                        hint="Facoltativo, ma molto utile: una foto aiuta il tecnico a capire il problema prima del sopralluogo."
                      />
                    </div>
                  </motion.div>
                )}

                {form.categoria === "Invio Documenti" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-5 space-y-4"
                  >
                    <SelectField
                      label="Tipo di documento"
                      value={form.subcategoria}
                      onChange={(v) => update("subcategoria", v)}
                      options={subCategorieDoc}
                      error={getFieldError("subcategoria")}
                      required
                    />
                    <FileUpload
                      file={form.file}
                      onChange={(f) => update("file", f)}
                      onRemove={() => update("file", null)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </FormSection>

            {/* ─── Section: Messaggio ─── */}
            <FormSection
              stepNumber={4}
              icon={<FileText className="w-4 h-4" />}
              title="Messaggio"
              description="Descrivi la tua richiesta in modo dettagliato"
            >
              <div>
                <textarea
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3.5 text-sm focus:outline-none focus:ring-2 transition-all min-h-[140px] resize-y bg-white placeholder:text-neutral-400",
                    getFieldError("messaggio")
                      ? "border-red-300 focus:ring-red-500/20 focus:border-red-500"
                      : "border-neutral-300 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
                  )}
                  placeholder="Es. Segnalo una perdita d'acqua dal soffitto del box al piano -1, presente da circa 3 giorni..."
                  value={form.messaggio}
                  onChange={(e) => update("messaggio", e.target.value)}
                  onBlur={() => finalizeField("messaggio")}
                  maxLength={2000}
                />
                <div className="mt-1.5 flex items-center justify-between">
                  {getFieldError("messaggio") ? (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {getFieldError("messaggio")}
                    </p>
                  ) : <span />}
                  <p className={cn(
                    "text-xs tabular-nums",
                    form.messaggio.length > 1800 ? "text-amber-600" : "text-neutral-500"
                  )}>
                    {form.messaggio.length} / 2000
                  </p>
                </div>
              </div>
            </FormSection>

            {/* ─── Privacy ─── */}
            <div className="rounded-2xl bg-gradient-to-br from-neutral-50 to-white p-4 sm:p-5 ring-1 ring-neutral-200">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative pt-0.5">
                  <input
                    id="cons"
                    type="checkbox"
                    checked={form.consenso}
                    onChange={(e) => update("consenso", e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className={cn(
                    "w-5 h-5 rounded-md ring-1 flex items-center justify-center transition-all",
                    form.consenso
                      ? "bg-[var(--brand)] ring-[var(--brand)]"
                      : "bg-white ring-neutral-300 group-hover:ring-neutral-400"
                  )}>
                    {form.consenso && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                  </span>
                </div>
                <span className="text-sm text-neutral-700 flex-1 leading-relaxed">
                  Ho letto e accetto l'
                  <a
                    className="text-[var(--brand)] hover:underline font-semibold mx-0.5"
                    href="https://www.dropbox.com/scl/fi/pg39geu63s5o2gtq04oq5/INFORMATIVA-SUL-TRATTAMENTO-DEI-DATI-PERSONALI.pdf?rlkey=7zzihoi92roiiqkydn9frt1p9&dl=0"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    informativa sulla privacy
                  </a>
                  <span className="text-red-500">*</span>
                </span>
              </label>
            </div>

            {/* ─── Submit ─── */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <motion.button
                disabled={sending || cooldown > 0}
                onClick={submit}
                whileHover={!sending && !cooldown ? { scale: 1.01 } : {}}
                whileTap={!sending && !cooldown ? { scale: 0.99 } : {}}
                className={cn(
                  "flex-1 relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-white font-semibold text-base transition-all",
                  sending || cooldown
                    ? "bg-neutral-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-[var(--brand)] via-emerald-600 to-emerald-700 shadow-lg hover:shadow-xl"
                )}
              >
                {!(sending || cooldown) && (
                  <span
                    aria-hidden
                    className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-[linear-gradient(110deg,transparent,rgba(255,255,255,.25),transparent)] bg-[length:200%_100%] animate-shimmer"
                  />
                )}
                {sending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Invio in corso…</>
                ) : (
                  <><Send className="w-5 h-5" />Invia segnalazione</>
                )}
              </motion.button>
              {cooldown > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-neutral-600 text-center sm:text-left px-3"
                >
                  Prossimo invio tra <span className="font-semibold text-[var(--brand)] tabular-nums">{cooldown}s</span>
                </motion.div>
              )}
            </div>

            {/* ─── Result ─── */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -10 }}
                  className={cn(
                    "rounded-2xl border p-5 shadow-soft",
                    result.ok
                      ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-300"
                      : "bg-gradient-to-br from-red-50 to-white border-red-300"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center",
                      result.ok ? "bg-emerald-100" : "bg-red-100"
                    )}>
                      {result.ok ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-red-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {result.ok ? (
                        <>
                          <div className="font-display font-semibold text-emerald-900 text-lg leading-tight">Segnalazione inviata!</div>
                          <p className="text-sm text-emerald-800/80 mt-1">La tua richiesta è stata registrata correttamente.</p>
                          {result.ticket && (
                            <div className="mt-3 bg-white rounded-xl px-4 py-3 ring-1 ring-emerald-200">
                              <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Numero ticket</p>
                              <p className="font-mono font-bold text-emerald-700 text-lg tracking-tight select-all break-all">{result.ticket}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="font-display font-semibold text-red-900 text-lg leading-tight">Errore nell'invio</div>
                          <p className="text-sm text-red-700 mt-1">{result.error}</p>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setResult(null)}
                      className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
                      aria-label="Chiudi"
                    >
                      <X className={cn("w-4 h-4", result.ok ? "text-emerald-700" : "text-red-700")} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white/70 backdrop-blur rounded-2xl ring-1 ring-neutral-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-neutral-600 text-center sm:text-left">
              <Building2 className="w-4 h-4 text-[var(--brand)]" />
              <span>© {new Date().getFullYear()} <span className="font-semibold text-neutral-800">{brandName}</span> — Tutti i diritti riservati</span>
            </div>
            <div className="text-center sm:text-right text-xs text-neutral-500 tabular-nums">
              <span className="font-mono font-semibold text-neutral-700">v{APP_VERSION}</span>
              <span className="mx-2">·</span>
              Ultimo aggiornamento: <span className="font-semibold text-neutral-700">{BUILD_DATE_LABEL}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function FormSection({ stepNumber, icon, title, description, children }) {
  return (
    <section>
      <header className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center ring-1 ring-[var(--brand)]/20">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
              Step {stepNumber}
            </span>
          </div>
          <h3 className="font-display font-semibold text-lg text-neutral-900 leading-tight">{title}</h3>
          {description && <p className="text-sm text-neutral-600 mt-0.5">{description}</p>}
        </div>
      </header>
      <div className="pl-0 sm:pl-12">
        {children}
      </div>
    </section>
  );
}

function TextField({ label, value, onChange, onBlur, placeholder, type = "text", icon, required, error, hint }) {
  return (
    <div>
      <label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5 mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-2xl border py-3 text-sm focus:outline-none focus:ring-2 transition-all bg-white placeholder:text-neutral-400",
            icon ? "pl-10 pr-4" : "px-4",
            error
              ? "border-red-300 focus:ring-red-500/20 focus:border-red-500"
              : "border-neutral-300 hover:border-neutral-400 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
          )}
        />
      </div>
      {error ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-xs text-red-600 flex items-center gap-1"
        >
          <AlertCircle className="w-3 h-3" />
          {error}
        </motion.p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

function SelectField({ label, value, onChange, options = [], required, error }) {
  return (
    <div>
      <label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5 mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "appearance-none w-full rounded-2xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 bg-white transition-all",
            error
              ? "border-red-300 focus:ring-red-500/20 focus:border-red-500"
              : "border-neutral-300 hover:border-neutral-400 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
          )}
        >
          <option value="">— Seleziona —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-xs text-red-600 flex items-center gap-1"
        >
          <AlertCircle className="w-3 h-3" />
          {error}
        </motion.p>
      )}
    </div>
  );
}

function CategoryGrid({ categories, selected, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isSelected = selected === cat.value;
        const isPrimary = cat.primary;
        return (
          <motion.button
            key={cat.value}
            type="button"
            onClick={() => onSelect(cat.value)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              // v9.3 - "flex flex-col justify-start" evita che il browser centri
              // verticalmente il contenuto dei button più corti: senza questo,
              // le card con titolo su una riga sola avevano icona e testo più in basso
              // rispetto a quelle con titolo su due righe.
              "relative p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-start",
              isSelected
                ? "border-[var(--brand)] bg-gradient-to-br from-[var(--brand)]/8 to-white shadow-lift"
                : isPrimary
                  ? "border-[var(--brand)]/35 bg-[var(--brand)]/5 shadow-soft hover:border-[var(--brand)]/60"
                  : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-soft"
            )}
          >
            {isSelected && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[var(--brand)] flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </span>
            )}
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                isSelected
                  ? "bg-[var(--brand)] text-white shadow-md"
                  : isPrimary
                    ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                    : "bg-neutral-100 text-neutral-600"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pr-5">
                <div className={cn(
                  "font-semibold text-sm mb-1 leading-tight min-h-[2.25rem]",
                  isSelected || isPrimary ? "text-[var(--brand)]" : "text-neutral-900"
                )}>
                  {cat.value}
                  {isPrimary && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[var(--brand)] text-white tracking-wider">
                      PRINCIPALE
                    </span>
                  )}
                </div>
                <div className={cn(
                  "text-xs line-clamp-2",
                  isPrimary ? "text-neutral-700" : "text-neutral-600"
                )}>
                  {cat.desc}
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function FileUpload({ file, onChange, onRemove, label = "Carica file", hint, required = true }) {
  const inputRef = React.useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) onChange(f);
  };

  return (
    <div>
      <label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5 mb-1.5">
        <Paperclip className="w-4 h-4" />
        {label}
        {required
          ? <span className="text-red-500">*</span>
          : <span className="font-normal text-neutral-500">(facoltativo)</span>}
      </label>
      {hint && <p className="text-xs text-neutral-500 mb-2 -mt-0.5">{hint}</p>}

      {!file ? (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl transition-all cursor-pointer",
            dragOver
              ? "border-[var(--brand)] bg-[var(--brand)]/10"
              : "border-neutral-300 hover:border-[var(--brand)] hover:bg-[var(--brand)]/5"
          )}
        >
          <div className="flex flex-col items-center justify-center px-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center mb-2">
              <Paperclip className="w-5 h-5 text-[var(--brand)]" />
            </div>
            <p className="text-sm text-neutral-700 font-semibold">Clicca o trascina il file qui</p>
            <p className="text-xs text-neutral-500 mt-1">PDF, JPG, JPEG o PNG · max 10 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => { if (e.target.files?.[0]) onChange(e.target.files[0]); }}
            className="hidden"
          />
        </label>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 p-4 bg-[var(--brand)]/5 border border-[var(--brand)]/25 rounded-2xl"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/15 flex items-center justify-center flex-shrink-0">
            <Paperclip className="w-5 h-5 text-[var(--brand)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900 truncate">{file.name}</p>
            <p className="text-xs text-neutral-600">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
            aria-label="Rimuovi file"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
