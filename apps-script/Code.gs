/**
 * Régie publicitaire Callo 2027 — Script Google (Apps Script)
 * ------------------------------------------------------------
 * Reçoit les envois du mini-site (visite avec provenance, formulaire,
 * téléchargements, commentaires, dépôt de fichiers) et les événements Brevo
 * (envoi, ouverture, clic, rebond, désinscription), puis alimente :
 *   - l'onglet « Suivi »      : une ligne par contact, statut et délais
 *   - l'onglet « Journal »    : chaque événement horodaté
 *   - l'onglet « Tableau de bord » : volumes, taux, chiffre d'affaires
 *   - l'onglet « Parcours »   : provenance, entonnoir et expérience partenaire
 *
 * Installation : voir PROCESS_GOOGLE_SHEET_KPI.md
 * Version : 2.0
 */

// ===================== CONFIGURATION =====================
var CONFIG = {
  TOKEN: 'callo2027-nQ7xW2',                       // identique à js/config.js
  NOTIFY_EMAIL: 'd.bougreau@lyceemarcelcallo.org', // alertes réponses / dépôts
  SEND_ACK_TO_PARTNER: true,                       // accusé de réception après dépôt
  DRIVE_FOLDER_NAME: 'Régie Callo 2027 - Dépôts partenaires',
  MAX_FILE_MB: 20,
  TZ: 'Europe/Paris'
};

// Colonnes de l'onglet « Suivi » (une ligne par contact, clé = e-mail)
var HEADERS = [
  'E-mail', 'Entreprise', 'Nom', 'Prénom', 'Fonction', 'Téléphone',
  'Date envoi e-mail', 'Date ouverture e-mail', 'Date clic e-mail', 'Date 1re visite site',
  'Date réponse formulaire', 'Intérêt', 'Formats choisis', 'Raison (si non)', 'RGPD opt-in',
  'Date DL plaquette', 'Date DL CGV', 'Date DL bon de commande', 'Variante bon de commande',
  'Date réception bon de commande', 'Date réception encart', 'Date réception logo', 'Dossier Drive',
  'Date envoi devis (manuel)', 'Date envoi BAT (manuel)', 'Date validation BAT (manuel)', 'Montant net € (manuel)',
  'Commentaire partenaire', 'Statut', 'Dernière activité', 'Etat e-mail',
  // --- analyse de provenance et d'expérience (remplissage automatique) ---
  'Canal', 'Source', 'Page d\'entrée', 'Referrer', 'Premier contact',
  'Délai clic→réponse (h)', 'Délai réponse→BC (j)', 'Délai BC→documents (j)', 'Délai documents→BAT (j)',
  'Score engagement'
];
var DATE_COLS = ['Date envoi e-mail', 'Date ouverture e-mail', 'Date clic e-mail', 'Date 1re visite site',
  'Date réponse formulaire', 'Date DL plaquette', 'Date DL CGV', 'Date DL bon de commande',
  'Date réception bon de commande', 'Date réception encart', 'Date réception logo',
  'Date envoi devis (manuel)', 'Date envoi BAT (manuel)', 'Date validation BAT (manuel)',
  'Dernière activité', 'Premier contact'];
var SHEET_SUIVI = 'Suivi', SHEET_LOG = 'Journal', SHEET_KPI = 'Tableau de bord', SHEET_PARCOURS = 'Parcours';
var VERSION = 'v2.0';

// Libellés lisibles pour les canaux
var CANAUX = {
  email1: 'Emailing — envoi principal',
  relance1: 'Emailing — relance 1',
  'relance2': 'Emailing — relance 2',
  'dernier-mail': 'Emailing — dernier mail',
  'email1-bas': 'Emailing — envoi principal (CTA bas)',
  direct: 'Site direct / recherche',
  qr: 'QR code / support imprimé',
  bouche: 'Bouche-à-oreille',
  lien: 'Lien partagé'
};

// ===================== POINTS D'ENTRÉE =====================
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.k && p.k === CONFIG.TOKEN && p.action === 'kpi') {
    var sh = sheet_(SHEET_SUIVI);
    var n = Math.max(0, sh.getLastRow() - 1);
    return json_({ ok: true, version: VERSION, contacts: n, onglets: [SHEET_SUIVI, SHEET_LOG, SHEET_KPI, SHEET_PARCOURS] });
  }
  return json_({ ok: true, service: 'Régie Callo 2027', version: VERSION });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    var body = {};
    try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'JSON invalide' }); }
    var token = body.token || (e.parameter && e.parameter.k);
    if (token !== CONFIG.TOKEN) return json_({ ok: false, error: 'Non autorisé' });

    // Événement Brevo (webhook) : { event, email, ... }
    if (body.event && !body.action) return json_(handleBrevo_(body));

    switch (body.action) {
      case 'visite':      return json_(handleVisite_(body));
      case 'reponse':     return json_(handleReponse_(body));
      case 'download':    return json_(handleDownload_(body));
      case 'commentaire': return json_(handleCommentaire_(body));
      case 'depot':       return json_(handleDepot_(body));
      default:            return json_({ ok: false, error: 'Action inconnue' });
    }
  } catch (err) {
    log_('ERREUR', '', String(err && err.stack || err));
    return json_({ ok: false, error: 'Erreur serveur' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ===================== PROVENANCE =====================
/** Traduit un code source (c=, utm_source=) en canal lisible. */
function canal_(source) {
  var s = String(source || '').toLowerCase().trim();
  if (!s) return 'Site direct / recherche';
  if (CANAUX[s]) return CANAUX[s];
  if (s.indexOf('email') === 0) return 'Emailing — ' + s;
  if (s.indexOf('relance') === 0) return 'Emailing — ' + s;
  return s;
}

/** Enregistre la provenance d'une première visite. */
function provenance_(row, b) {
  if (b.source) setIfEmpty_(row, 'Source', String(b.source).slice(0, 60));
  if (b.canal || b.source) setIfEmpty_(row, 'Canal', canal_(b.canal || b.source));
  if (b.page) setIfEmpty_(row, 'Page d\'entrée', String(b.page).slice(0, 60));
  if (b.referrer) setIfEmpty_(row, 'Referrer', String(b.referrer).slice(0, 120));
  setIfEmpty_(row, 'Premier contact', new Date());
}

// ===================== GESTIONNAIRES =====================
function handleBrevo_(b) {
  var email = String(b.email || '').toLowerCase().trim();
  if (!email) return { ok: false, error: 'e-mail manquant' };
  var ev = String(b.event).toLowerCase();
  var row = upsert_(email);
  var when = parseDate_(b.date || b['event-date'] || b.ts_event || b.ts) || new Date();
  if (['request', 'sent', 'delivered', 'delivery'].indexOf(ev) >= 0) setIfEmpty_(row, 'Date envoi e-mail', when);
  else if (['opened', 'unique_opened', 'uniqueopened', 'proxy_open', 'open'].indexOf(ev) >= 0) setIfEmpty_(row, 'Date ouverture e-mail', when);
  else if (['click', 'clicks'].indexOf(ev) >= 0) { setIfEmpty_(row, 'Date clic e-mail', when); setIfEmpty_(row, 'Date ouverture e-mail', when); }
  else if (['hard_bounce', 'soft_bounce', 'blocked', 'invalid_email', 'spam', 'unsubscribe', 'unsubscribed'].indexOf(ev) >= 0) set_(row, 'Etat e-mail', ev);
  if (b.campaign || b.tag) { setIfEmpty_(row, 'Source', String(b.campaign || b.tag)); setIfEmpty_(row, 'Canal', canal_(b.campaign || b.tag)); }
  log_('BREVO', email, ev);
  finish_(row);
  return { ok: true };
}

function handleVisite_(b) {
  var email = clean_(b.email);
  if (!email) { log_('VISITE', '(anonyme)', [b.source, b.page, b.referrer].join(' · ')); return { ok: true }; }
  var row = upsert_(email);
  provenance_(row, b);
  setIfEmpty_(row, 'Date 1re visite site', new Date());
  setIfEmpty_(row, 'Date clic e-mail', new Date());
  log_('VISITE', email, [b.source || '', b.page || '', b.referrer || ''].join(' · '));
  finish_(row);
  return { ok: true };
}

function handleReponse_(b) {
  var email = clean_(b.email);
  if (!email) return { ok: false, error: 'e-mail manquant' };
  var row = upsert_(email);
  provenance_(row, b);
  set_(row, 'Entreprise', b.entreprise); set_(row, 'Nom', b.nom); set_(row, 'Prénom', b.prenom);
  set_(row, 'Fonction', b.fonction); set_(row, 'Téléphone', b.tel);
  set_(row, 'Date réponse formulaire', new Date());
  set_(row, 'Intérêt', { oui: 'Oui', peut: 'Peut-être', non: 'Non' }[b.interet] || b.interet);
  set_(row, 'Formats choisis', (b.formats || []).join(' | '));
  set_(row, 'Raison (si non)', String(b.raison || '').slice(0, 300));
  set_(row, 'RGPD opt-in', b.rgpd ? 'Oui' : 'Non');
  setIfEmpty_(row, 'Date 1re visite site', new Date());
  log_('REPONSE', email, b.interet + ' ' + (b.formats || []).join(','));
  finish_(row);
  notify_('Réponse partenaire : ' + b.entreprise + ' (' + (b.interet || '') + ')',
    'Entreprise : ' + b.entreprise + '\nContact : ' + b.prenom + ' ' + b.nom + ' (' + b.fonction + ')\nTél : ' + b.tel + '\nE-mail : ' + email +
    '\nIntérêt : ' + b.interet + '\nFormats : ' + (b.formats || []).join(', ') +
    '\nProvenance : ' + (b.canal || canal_(b.source) || 'inconnue') + (b.source ? ' (' + b.source + ')' : '') +
    (b.raison ? '\nRaison : ' + b.raison : ''));
  return { ok: true };
}

function handleDownload_(b) {
  var email = clean_(b.email);
  var map = { 'plaquette': 'Date DL plaquette', 'cgv': 'Date DL CGV', 'bon-de-commande-pdf': 'Date DL bon de commande', 'bon-de-commande-docx': 'Date DL bon de commande' };
  log_('TELECHARGEMENT', email || '(anonyme)', (b.doc || '') + ' ' + (b.detail || ''));
  if (email && map[b.doc]) {
    var row = upsert_(email);
    provenance_(row, b);
    setIfEmpty_(row, map[b.doc], new Date());
    if (b.doc.indexOf('bon-de-commande') === 0 && b.detail) set_(row, 'Variante bon de commande', b.detail);
    finish_(row);
  }
  return { ok: true };
}

function handleCommentaire_(b) {
  var email = clean_(b.email);
  log_('COMMENTAIRE', email || '(anonyme)', String(b.message || '').slice(0, 500));
  if (email) {
    var row = upsert_(email);
    var old = get_(row, 'Commentaire partenaire');
    set_(row, 'Commentaire partenaire', (old ? old + '\n---\n' : '') + Utilities.formatDate(new Date(), CONFIG.TZ, 'dd/MM/yyyy HH:mm') + ' : ' + String(b.message || '').slice(0, 2000));
    finish_(row);
  }
  notify_('Commentaire partenaire' + (b.entreprise ? ' : ' + b.entreprise : ''), String(b.message || '') + '\n\nE-mail : ' + (email || 'inconnu'));
  return { ok: true };
}

function handleDepot_(b) {
  var email = clean_(b.email);
  if (!email) return { ok: false, error: 'e-mail manquant' };
  var files = b.files || [];
  var total = 0;
  files.forEach(function (f) { total += (f.data || '').length * 0.75; });
  if (total > CONFIG.MAX_FILE_MB * 1048576) return { ok: false, error: 'Fichiers trop volumineux' };

  var entreprise = String(b.entreprise || 'Sans-nom').trim();
  var folder = companyFolder_(entreprise);
  var labels = { bon: 'bon-de-commande', encart: 'encart', logo: 'logo' };
  var cols = { bon: 'Date réception bon de commande', encart: 'Date réception encart', logo: 'Date réception logo' };
  var row = upsert_(email);
  provenance_(row, b);
  set_(row, 'Entreprise', get_(row, 'Entreprise') || entreprise);
  var stamp = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyyMMdd-HHmm');
  files.forEach(function (f) {
    var name = safeName_(f.name || 'fichier');
    var blob = Utilities.newBlob(Utilities.base64Decode(f.data || ''), f.mime || 'application/octet-stream',
      labels[f.field] + '_' + safeName_(entreprise) + '_' + stamp + '_' + name);
    folder.createFile(blob);
    if (cols[f.field]) set_(row, cols[f.field], new Date());
  });
  set_(row, 'Dossier Drive', folder.getUrl());
  log_('DEPOT', email, files.length + ' fichier(s) — ' + folder.getUrl());
  finish_(row);
  notify_('Dépôt de documents : ' + entreprise, 'Fichiers reçus : ' + files.map(function (f) { return f.field + ' = ' + f.name; }).join(', ') +
    '\nDossier : ' + folder.getUrl() + '\nE-mail : ' + email + '\nBAT à envoyer sous 3 jours ouvrés.');
  if (CONFIG.SEND_ACK_TO_PARTNER) {
    try {
      MailApp.sendEmail({
        to: email, name: 'Régie publicitaire Callo', replyTo: CONFIG.NOTIFY_EMAIL,
        subject: 'Callo 2027 : nous avons bien reçu vos documents',
        body: 'Bonjour,\n\nMerci de votre envoi : le bon de commande, votre encart et votre logo sont bien reçus.\n' +
          'Le professionnel en charge de la mise en page vous adressera un BAT à valider sous 3 jours ouvrés.\n\n' +
          'Une question ? Répondez à ce message ou contactez Damien BOUGREAU, Responsable Suivi Partenaires : ' + CONFIG.NOTIFY_EMAIL + ' · +33 7 66 88 93 32.\n\n' +
          'Régie publicitaire Marcel Callo · OGEC Lycée Marcel Callo, 35600 Redon'
      });
    } catch (err) { log_('ERREUR', email, 'Accusé non envoyé : ' + err); }
  }
  return { ok: true };
}

// ===================== FEUILLE « SUIVI » =====================
function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function colIndex_(header) {
  var i = HEADERS.indexOf(header);
  if (i < 0) throw new Error('Colonne inconnue : ' + header);
  return i + 1;
}

/** Retourne le n° de ligne du contact, en le créant si besoin. */
function upsert_(email) {
  var sh = sheet_(SHEET_SUIVI);
  if (sh.getLastRow() < 1) setup_();
  var last = sh.getLastRow();
  if (last >= 2) {
    var emails = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if (String(emails[i][0]).toLowerCase().trim() === email) return i + 2;
    }
  }
  sh.appendRow([email]);
  var r = sh.getLastRow();
  DATE_COLS.forEach(function (h) { sh.getRange(r, colIndex_(h)).setNumberFormat('dd/MM/yyyy HH:mm'); });
  return r;
}

function get_(row, header) { return sheet_(SHEET_SUIVI).getRange(row, colIndex_(header)).getValue(); }
function set_(row, header, value) {
  if (value === undefined || value === null || value === '') return;
  sheet_(SHEET_SUIVI).getRange(row, colIndex_(header)).setValue(value);
}
function setIfEmpty_(row, header, value) {
  var c = sheet_(SHEET_SUIVI).getRange(row, colIndex_(header));
  if (c.getValue() === '' || c.getValue() === null) c.setValue(value);
}
function has_(row, h) { var v = get_(row, h); return v !== '' && v !== null; }
function date_(row, h) { var v = get_(row, h); return (v instanceof Date) ? v : null; }

/** Écarts en heures / jours entre deux jalons (null si l'un manque). */
function ecart_(row, h1, h2, unit) {
  var a = date_(row, h1), b = date_(row, h2);
  if (!a || !b) return '';
  var diff = (b.getTime() - a.getTime()) / (unit === 'h' ? 3600000 : 86400000);
  return Math.round(diff * 10) / 10;
}

/** Renseigne les délais de parcours et le score d'engagement. */
function analyse_(row) {
  var d1 = ecart_(row, 'Date clic e-mail', 'Date réponse formulaire', 'h');
  if (d1 === '' && has_(row, 'Date 1re visite site') && has_(row, 'Date réponse formulaire')) d1 = ecart_(row, 'Date 1re visite site', 'Date réponse formulaire', 'h');
  if (d1 !== '') set_(row, 'Délai clic→réponse (h)', d1);

  var d2 = ecart_(row, 'Date réponse formulaire', 'Date réception bon de commande', 'j'); if (d2 !== '') set_(row, 'Délai réponse→BC (j)', d2);
  var d3 = ecart_(row, 'Date réception bon de commande', 'Date réception logo', 'j'); if (d3 !== '') set_(row, 'Délai BC→documents (j)', d3);
  var d4 = ecart_(row, 'Date réception logo', 'Date envoi BAT (manuel)', 'j');
  if (d4 === '') d4 = ecart_(row, 'Date réception bon de commande', 'Date envoi BAT (manuel)', 'j');
  if (d4 !== '') set_(row, 'Délai documents→BAT (j)', d4);

  var score = 0;
  if (has_(row, 'Date ouverture e-mail')) score += 10;
  if (has_(row, 'Date clic e-mail')) score += 15;
  if (has_(row, 'Date 1re visite site')) score += 10;
  if (has_(row, 'Date réponse formulaire')) score += 25;
  if (has_(row, 'Date DL bon de commande')) score += 10;
  if (has_(row, 'Date réception bon de commande')) score += 15;
  if (has_(row, 'Date réception encart') && has_(row, 'Date réception logo')) score += 10;
  if (has_(row, 'Date validation BAT (manuel)')) score += 5;
  set_(row, 'Score engagement', Math.min(100, score));
}

/** Met à jour « Dernière activité », « Statut » et les calculs d'analyse. */
function finish_(row) {
  set_(row, 'Dernière activité', new Date());
  analyse_(row);
  set_(row, 'Statut', computeStatus_(row));
}

function computeStatus_(row) {
  if (has_(row, 'Date validation BAT (manuel)')) return '9 · BAT validé';
  if (has_(row, 'Date envoi BAT (manuel)')) return '8 · BAT envoyé, à valider';
  if (has_(row, 'Date réception encart') && has_(row, 'Date réception logo') && has_(row, 'Date réception bon de commande')) return '7 · Documents reçus, BAT à produire';
  if (has_(row, 'Date réception bon de commande')) return '6 · Bon de commande reçu (encart/logo en attente)';
  if (has_(row, 'Date DL bon de commande')) return '5 · Bon de commande téléchargé';
  if (has_(row, 'Date réponse formulaire')) {
    var i = String(get_(row, 'Intérêt'));
    return i === 'Non' ? '0 · Non (relance N+1)' : (i === 'Peut-être' ? '4 · Peut-être, à relancer' : '4 · Oui, à convertir');
  }
  if (has_(row, 'Date 1re visite site')) return '3 · A visité le site';
  if (has_(row, 'Date clic e-mail')) return '2 · A cliqué';
  if (has_(row, 'Date ouverture e-mail')) return '1 · A ouvert';
  if (has_(row, 'Date envoi e-mail')) return '1 · Envoyé';
  return 'Nouveau';
}

// Recalcul du statut quand une date « manuel » est saisie à la main
function onEdit(e) {
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== SHEET_SUIVI || e.range.getRow() < 2) return;
    var h = HEADERS[e.range.getColumn() - 1] || '';
    if (/\(manuel\)/.test(h)) { var r = e.range.getRow(); analyse_(r); set_(r, 'Statut', computeStatus_(r)); set_(r, 'Dernière activité', new Date()); }
  } catch (err) {}
}

// ===================== JOURNAL, DRIVE, MAIL =====================
function log_(type, email, detail) {
  var sh = sheet_(SHEET_LOG);
  if (sh.getLastRow() < 1) { sh.appendRow(['Date', 'Événement', 'E-mail', 'Détail']); sh.setFrozenRows(1); sh.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss'); }
  sh.appendRow([new Date(), type, email, String(detail || '').slice(0, 1000)]);
}

function companyFolder_(entreprise) {
  var roots = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
  var root = roots.hasNext() ? roots.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
  var name = safeName_(entreprise);
  var subs = root.getFoldersByName(name);
  return subs.hasNext() ? subs.next() : root.createFolder(name);
}

function notify_(subject, body) {
  try { MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, '[Régie Callo] ' + subject, body); } catch (err) { log_('ERREUR', '', 'Notification : ' + err); }
}

// ===================== OUTILS =====================
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(v) { v = String(v || '').toLowerCase().trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : ''; }
function safeName_(s) { return String(s).replace(/[\\\/:*?"<>|\r\n]+/g, '-').replace(/\s+/g, '_').slice(0, 80); }
function parseDate_(v) { if (!v) return null; var d = new Date(typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : String(v).replace(' ', 'T')); return isNaN(d.getTime()) ? null : d; }
/** Lettre de colonne depuis un intitulé. */
function letter_(h) {
  var n = colIndex_(h), l = '';
  while (n > 0) { var m = (n - 1) % 26; l = String.fromCharCode(65 + m) + l; n = Math.floor((n - m) / 26); }
  return l;
}
function colRange_(h) { var l = letter_(h); return "'" + SHEET_SUIVI + "'!" + l + '2:' + l; }

// ===================== INITIALISATION =====================
function setup() {
  setup_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Onglets Suivi, Journal, Tableau de bord et Parcours prêts.');
}

function setup_() {
  var sh = sheet_(SHEET_SUIVI);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#355D8D').setFontColor('#ffffff').setWrap(true);
  sh.setFrozenRows(1); sh.setFrozenColumns(2);
  DATE_COLS.forEach(function (h) { sh.getRange(2, colIndex_(h), 5000, 1).setNumberFormat('dd/MM/yyyy HH:mm'); });
  sh.setColumnWidths(1, HEADERS.length, 130);
  sh.setColumnWidth(colIndex_('Statut'), 270);
  sh.setColumnWidth(colIndex_('Canal'), 210);
  sh.getRange(2, colIndex_('Commentaire partenaire'), 5000, 1).setWrap(true);
  log_('SETUP', '', 'Initialisation ' + VERSION);
  buildDashboard_();
  buildParcours_();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sh);
}

// ===================== TABLEAU DE BORD =====================
function buildDashboard_() {
  var d = sheet_(SHEET_KPI); d.clear();
  var K = "'" + SHEET_SUIVI + "'!";
  var B = function (n) { return '$B$' + n; };
  var rows = [
    ['KPI régie publicitaire Callo 2027 — ' + VERSION, '', ''],
    ['Indicateur', 'Valeur', 'Taux'],
    ['Contacts suivis', '=COUNTA(' + colRange_('E-mail') + ')', ''],
    ['E-mails envoyés', '=COUNTA(' + colRange_('Date envoi e-mail') + ')', ''],
    ['E-mails ouverts', '=COUNTA(' + colRange_('Date ouverture e-mail') + ')', '=IFERROR(B5/B4,0)'],
    ['Clics e-mail', '=COUNTA(' + colRange_('Date clic e-mail') + ')', '=IFERROR(B6/B4,0)'],
    ['Visites du site', '=COUNTA(' + colRange_('Date 1re visite site') + ')', '=IFERROR(B7/B3,0)'],
    ['Réponses au formulaire', '=COUNTA(' + colRange_('Date réponse formulaire') + ')', '=IFERROR(B8/B3,0)'],
    ['  dont Oui', '=COUNTIF(' + colRange_('Intérêt') + ',"Oui")', '=IFERROR(B9/B8,0)'],
    ['  dont Peut-être', '=COUNTIF(' + colRange_('Intérêt') + ',"Peut-être")', '=IFERROR(B10/B8,0)'],
    ['  dont Non', '=COUNTIF(' + colRange_('Intérêt') + ',"Non")', '=IFERROR(B11/B8,0)'],
    ['Bons de commande téléchargés', '=COUNTA(' + colRange_('Date DL bon de commande') + ')', '=IFERROR(B12/B8,0)'],
    ['Bons de commande reçus', '=COUNTA(' + colRange_('Date réception bon de commande') + ')', '=IFERROR(B13/B8,0)'],
    ['Encarts reçus', '=COUNTA(' + colRange_('Date réception encart') + ')', '=IFERROR(B14/B8,0)'],
    ['Logos reçus', '=COUNTA(' + colRange_('Date réception logo') + ')', '=IFERROR(B15/B8,0)'],
    ['BAT envoyés', '=COUNTA(' + colRange_('Date envoi BAT (manuel)') + ')', '=IFERROR(B16/B13,0)'],
    ['BAT validés', '=COUNTA(' + colRange_('Date validation BAT (manuel)') + ')', '=IFERROR(B17/B16,0)'],
    ['Dossiers complets (BC + encart + logo)', '=COUNTIFS(' + colRange_('Date réception bon de commande') + ',"<>",' + colRange_('Date réception encart') + ',"<>",' + colRange_('Date réception logo') + ',"<>")', ''],
    ['Chiffre d\'affaires net saisi (€)', '=SUM(' + colRange_('Montant net € (manuel)') + ')', ''],
    ['Panier moyen (€)', '=IFERROR(B19/B13,0)', ''],
    ['Score engagement moyen', '=IFERROR(AVERAGE(' + colRange_('Score engagement') + '),0)', ''],
    ['Délai moyen clic → réponse (h)', '=IFERROR(AVERAGE(' + colRange_('Délai clic→réponse (h)') + '),0)', ''],
    ['Délai moyen réponse → BC (j)', '=IFERROR(AVERAGE(' + colRange_('Délai réponse→BC (j)') + '),0)', ''],
    ['Délai moyen réception → BAT (j)', '=IFERROR(AVERAGE(' + colRange_('Délai documents→BAT (j)') + '),0)', ''],
    ['Réservation possible jusqu\'au', '01/12/2026', ''],
    ['Parution Actualycée', '18/12/2026', '']
  ];
  d.getRange(1, 1, rows.length, 3).setFormulas(rows);
  d.getRange('A1').setFontSize(14).setFontWeight('bold').setFontColor('#355D8D');
  d.getRange('A2:C2').setFontWeight('bold').setBackground('#355D8D').setFontColor('#ffffff');
  d.getRange('C5:C6').setNumberFormat('0.0%');   // ouverture / clic / envoyés
  d.getRange('C7:C17').setNumberFormat('0.0%');  // conversions
  d.getRange('B19:B20').setNumberFormat('# ##0 "€"');
  d.getRange('B22:B24').setNumberFormat('0.0');
  d.setColumnWidth(1, 330); d.setColumnWidth(2, 130); d.setColumnWidth(3, 110);
  d.getRange('A3:C3').setFontWeight('bold');
  d.getRange('A26:C27').setFontColor('#4a5b70');
  var notes = d.getRange('E1');
  notes.setValue('Lecture :\n· Taux ligne 5 = ouvertures / envoyés (taux d\'ouverture réel).\n· Taux ligne 6 = clics / envoyés (taux de clic réel).\n· Lignes 7 à 17 : conversion par rapport à l\'étape précédente, pas au total des contacts.\n· Délais : renseignés automatiquement à chaque événement.\n· Les colonnes « (manuel) » se saisissent à la main.');
  notes.setWrap(true).setVerticalAlignment('top').setFontSize(10).setFontColor('#4a5b70');
  d.setColumnWidth(5, 380);
}

// ===================== PARCOURS PARTENAIRE =====================
function buildParcours_() {
  var p = sheet_(SHEET_PARCOURS); p.clear();
  var K = "'" + SHEET_SUIVI + "'!";

  // --- 1. Entonnoir ---
  var funnel = [
    ['ANALYSE DU PARCOURS PARTENAIRE — ' + VERSION, '', '', ''],
    ['Étape', 'Nombre', 'Conversion depuis l\'étape précédente', 'Commentaire'],
    ['1 · E-mail envoyé', '=COUNTA(' + colRange_('Date envoi e-mail') + ')', '', 'Base de la campagne'],
    ['2 · E-mail ouvert', '=COUNTA(' + colRange_('Date ouverture e-mail') + ')', '=IFERROR(B4/B3,0)', 'Ouvertures fiabilisées par les webhooks Brevo'],
    ['3 · Lien cliqué', '=COUNTA(' + colRange_('Date clic e-mail') + ')', '=IFERROR(B5/B4,0)', 'Le clic est le vrai signal d\'intérêt'],
    ['4 · Site visité', '=COUNTA(' + colRange_('Date 1re visite site') + ')', '=IFERROR(B6/B5,0)', 'Écart clic/visite = problème de page'],
    ['5 · Formulaire rempli', '=COUNTA(' + colRange_('Date réponse formulaire') + ')', '=IFERROR(B7/B6,0)', 'Écart visite/réponse = friction du formulaire'],
    ['6 · Réponse « Oui »', '=COUNTIF(' + colRange_('Intérêt') + ',"Oui")', '=IFERROR(B8/B7,0)', ''],
    ['7 · Bon de commande téléchargé', '=COUNTA(' + colRange_('Date DL bon de commande') + ')', '=IFERROR(B9/B8,0)', ''],
    ['8 · Bon de commande reçu', '=COUNTA(' + colRange_('Date réception bon de commande') + ')', '=IFERROR(B10/B9,0)', 'Écart téléchargé/reçu = frein de signature'],
    ['9 · Dossier complet', '=COUNTIFS(' + colRange_('Date réception bon de commande') + ',"<>",' + colRange_('Date réception encart') + ',"<>",' + colRange_('Date réception logo') + ',"<>")', '=IFERROR(B11/B10,0)', 'BC + encart + logo'],
    ['10 · BAT validé', '=COUNTA(' + colRange_('Date validation BAT (manuel)') + ')', '=IFERROR(B12/B11,0)', 'Fin du parcours partenaire']
  ];
  p.getRange(1, 1, funnel.length, 4).setFormulas(funnel);
  p.getRange('A1').setFontSize(14).setFontWeight('bold').setFontColor('#355D8D');
  p.getRange('A2:D2').setFontWeight('bold').setBackground('#355D8D').setFontColor('#ffffff');
  p.getRange('C3:C13').setNumberFormat('0.0%');
  p.getRange('A3:A13').setFontWeight('bold');

  // --- 2. Provenance ---
  var r0 = 15;
  p.getRange(r0, 1, 1, 6).setValues([['PROVENANCE DES CONTACTS', '', '', '', '', '']]);
  p.getRange(r0, 1, 1, 6).setFontWeight('bold').setFontColor('#D4111F');
  p.getRange(r0 + 1, 1, 1, 6).setValues([['Canal', 'Contacts', 'Réponses', 'Taux de réponse', 'dont Oui', 'CA net (€)']]);
  p.getRange(r0 + 1, 1, 1, 6).setFontWeight('bold').setBackground('#355D8D').setFontColor('#ffffff');

  var canaux = Object.keys(CANAUX).map(function (k) { return CANAUX[k]; });
  canaux.push('Site direct / recherche');
  var vus = {}, ordre = [];
  canaux.forEach(function (c) { if (!vus[c]) { vus[c] = 1; ordre.push(c); } });

  var lignes = [];
  ordre.forEach(function (c, i) {
    var r = r0 + 2 + i;
    var cr = colRange_('Canal');
    var rr = colRange_('Date réponse formulaire');
    lignes.push([
      c,
      '=COUNTIF(' + cr + ',$A' + r + ')',
      '=COUNTIFS(' + cr + ',$A' + r + ',' + rr + ',"<>")',
      '=IFERROR(C' + r + '/B' + r + ',0)',
      '=COUNTIFS(' + cr + ',$A' + r + ',' + colRange_('Intérêt') + ',"Oui")',
      '=SUMIF(' + cr + ',$A' + r + ',' + colRange_('Montant net € (manuel)') + ')'
    ]);
  });
  var rInconnu = r0 + 2 + ordre.length;
  lignes.push(['(non renseigné)',
    '=COUNTIF(' + colRange_('Canal') + ',"")',
    '=COUNTIFS(' + colRange_('Canal') + ',"",' + colRange_('Date réponse formulaire') + ',"<>")',
    '=IFERROR(C' + rInconnu + '/B' + rInconnu + ',0)',
    '=COUNTIFS(' + colRange_('Canal') + ',"",' + colRange_('Intérêt') + ',"Oui")',
    '=SUMIF(' + colRange_('Canal') + ',"",' + colRange_('Montant net € (manuel)') + ')']);

  p.getRange(r0 + 2, 1, lignes.length, 6).setFormulas(lignes);
  p.getRange(r0 + 2, 4, lignes.length, 1).setNumberFormat('0.0%');
  p.getRange(r0 + 2, 6, lignes.length, 1).setNumberFormat('# ##0 "€"');
  var rTot = r0 + 2 + lignes.length;
  p.getRange(rTot, 1, 1, 6).setFormulas([['TOTAL', '=SUM(B' + (r0 + 2) + ':B' + (rTot - 1) + ')',
    '=SUM(C' + (r0 + 2) + ':C' + (rTot - 1) + ')', '=IFERROR(C' + rTot + '/B' + rTot + ',0)',
    '=SUM(E' + (r0 + 2) + ':E' + (rTot - 1) + ')', '=SUM(F' + (r0 + 2) + ':F' + (rTot - 1) + ')']]);
  p.getRange(rTot, 1, 1, 6).setFontWeight('bold').setBackground('#F4F6F1');
  p.getRange(rTot, 4).setNumberFormat('0.0%');
  p.getRange(rTot, 6).setNumberFormat('# ##0 "€"');

  // --- 3. Délais (expérience partenaire) ---
  var r1 = rTot + 3;
  p.getRange(r1, 1, 1, 4).setValues([['EXPÉRIENCE PARTENAIRE — DÉLAIS MESURÉS', '', '', '']]);
  p.getRange(r1, 1, 1, 4).setFontWeight('bold').setFontColor('#D4111F');
  p.getRange(r1 + 1, 1, 1, 4).setValues([['Jalon', 'Moyenne', 'Médiane', 'Cible']]);
  p.getRange(r1 + 1, 1, 1, 4).setFontWeight('bold').setBackground('#355D8D').setFontColor('#ffffff');
  var delais = [
    ['Clic e-mail → réponse (heures)', colRange_('Délai clic→réponse (h)'), 'moins de 24 h'],
    ['Réponse → bon de commande reçu (jours)', colRange_('Délai réponse→BC (j)'), 'moins de 7 j'],
    ['BC → encart + logo reçus (jours)', colRange_('Délai BC→documents (j)'), 'moins de 5 j'],
    ['Réception → BAT envoyé (jours)', colRange_('Délai documents→BAT (j)'), '3 j ouvrés max']
  ];
  var dl = [];
  delais.forEach(function (d, i) {
    var r = r1 + 2 + i;
    dl.push([d[0], '=IFERROR(ROUND(AVERAGE(' + d[1] + '),1),0)', '=IFERROR(MEDIAN(' + d[1] + '),0)', d[2]]);
  });
  p.getRange(r1 + 2, 1, dl.length, 4).setFormulas(dl);
  p.getRange(r1 + 2, 2, dl.length, 2).setNumberFormat('0.0');

  // --- 4. Points de friction ---
  var r2 = r1 + 2 + dl.length + 2;
  var fretes = [
    ['POINTS DE FRICTION À SURVEILLER', '', ''],
    ['Étape la plus faible', '=INDEX(A4:A13,MATCH(MIN(C4:C13),C4:C13,0))', ''],
    ['Taux de cette étape', '=MIN(C4:C13)', ''],
    ['Contacts bloqués à cette étape', '=INDEX(B4:B13,MATCH(MIN(C4:C13),C4:C13,0))-INDEX(B3:B12,MATCH(MIN(C4:C13),C4:C13,0))', ''],
    ['Réponses « Non »', '=COUNTIF(' + colRange_('Intérêt') + ',"Non")', ''],
    ['Contacts sans aucune activité', '=COUNTIFS(' + colRange_('Date envoi e-mail') + ',"",' + colRange_('Date 1re visite site') + ',"")', '']
  ];
  p.getRange(r2, 1, fretes.length, 3).setFormulas(fretes);
  p.getRange(r2, 1, 1, 3).setFontWeight('bold').setFontColor('#D4111F');
  p.getRange(r2 + 3, 2).setNumberFormat('0.0%');
  p.getRange(r2 + 6, 1, 1, 3).setFontColor('#4a5b70');

  p.setColumnWidth(1, 330); p.setColumnWidth(2, 110); p.setColumnWidth(3, 220); p.setColumnWidth(4, 300);
  p.getRange('E1').setValue('Comment lire cet onglet\n\n1. L\'entonnoir montre où les partenaires s\'arrêtent.\n2. La provenance compare les canaux : un canal qui amène des visites mais pas de réponses doit être réécrit.\n3. Les délais mesurent la promesse « 3 jours ouvrés pour le BAT ». Au-delà, le partenaire décroche.\n4. Les points de friction sont recalculés à chaque ouverture du fichier.');
  p.getRange('E1').setWrap(true).setVerticalAlignment('top').setFontSize(10).setFontColor('#4a5b70');
  p.setColumnWidth(5, 380);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Régie Callo')
    .addItem('Initialiser / réparer les feuilles', 'setup')
    .addItem('Recalculer tous les statuts et délais', 'recomputeAll')
    .addItem('Recalculer le parcours et le tableau de bord', 'rebuildReports')
    .addToUi();
}

function recomputeAll() {
  var sh = sheet_(SHEET_SUIVI), n = sh.getLastRow();
  for (var r = 2; r <= n; r++) { analyse_(r); set_(r, 'Statut', computeStatus_(r)); }
  SpreadsheetApp.getActiveSpreadsheet().toast('Statuts et délais recalculés (' + Math.max(0, n - 1) + ' contacts).');
}

function rebuildReports() {
  buildDashboard_();
  buildParcours_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Tableau de bord et Parcours régénérés.');
}
