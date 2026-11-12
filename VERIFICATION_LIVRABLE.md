# Vérification du livrable — Régie publicitaire Callo 2027

Document de relecture, à cocher point par point. Généré le 12/11/2026.
Version des fichiers : script KPI **v2.0**, site **4 pages**, gabarit Brevo **v2**.

---

## 1. Ce que contient le livrable

| Élément | Fichier | Rôle |
|---|---|---|
| Page d'accueil + formulaire | `index.html` | réponse Oui / Peut-être / Non, choix du format |
| Page de remerciement Oui / Peut-être | `merci.html` | plaquette, CGV, bon de commande pré-rempli, commentaire |
| Page de remerciement Non | `merci-non.html` | remerciement, relance N+1 |
| Espace de dépôt | `depot.html` | 3 fichiers obligatoires + BAT signé facultatif |
| Mise en forme | `css/style.css` | charte bleu / rouge, police Montserrat hébergée |
| Comportement + mesure | `js/app.js` | provenance, durée, appareil, dépôt |
| Configuration | `js/config.js` | URL du script Google + jeton |
| Script de suivi | `apps-script/Code.gs` | 4 onglets, dépôts Drive, alertes |
| Emailing | `email/brevo-gabarit.html` | 1 fichier à coller dans Brevo |
| Documents | `docs/` | plaquette V2.6, CGV V2.3, annexes, 6 bons de commande, mindmap |
| Images et police | `assets/` | 10 fichiers |
| Ce document | `VERIFICATION_LIVRABLE.md` | relecture |
| Process Google Sheet | `PROCESS_GOOGLE_SHEET_KPI.md` | installation pas à pas |
| Guide général | `TUTORIEL.md` | installation, planning, points à arbitrer |

---

## 2. Contrôles automatiques déjà passés

| Contrôle | Résultat |
|---|---|
| Prix identiques sur le site, dans l'email et dans le formulaire | **OK** — 320 / 400 / 480 / 650 / 700 € |
| Dates cohérentes site ↔ email | **OK** — réservation 01/12/2026, parution 18/12/2026 |
| Prix conformes à la plaquette V2.6 | **OK** (relevé dans le PDF) |
| Images de l'email accessibles en HTTP | **4 / 4 en 200** |
| Polices, CSS, JS, PDF, bons de commande sur le serveur | **200** sur les 16 ressources testées |
| Rendu ordinateur (1440 px) et mobile (390 / 375 px) | **sans débordement** |
| Colonnes de la feuille | **55 colonnes**, toutes nommées une seule fois |
| Formules du tableau de bord | **lettres de colonne vérifiées une à une** |
| Script exécuté en simulation (visite, réponse, clic, rebond, durée, dépôt, BAT, jeton invalide) | **7 scénarios passés** |
| Cumul du temps de visite | **vérifié** (42 s + 30 s = 72 s) |
| HTML de l'email au validateur W3C | **6 erreurs, toutes assumées** : 3 balises Brevo `{{ }}`, 2 `<font>` de secours pour le bouton, 0 erreur de structure |

---

## 3. À vérifier par vous — identité et mentions

- [ ] **Nom de l'établissement** : « Lycée Marcel Callo » partout, jamais « Marcel Callo » seul dans un titre officiel
- [ ] **Adresse** : 21 avenue Étienne Gascon, 35600 Redon
- [ ] **Entité juridique** : OGEC Lycée Marcel Callo
- [ ] **TVA** : « Prix nets, TVA non applicable (art. 261-7-1° b du CGI) » — à confirmer avec la comptabilité
- [ ] **Téléphone** : +33 7 66 88 93 32 (liens cliquables sur mobile)
- [ ] **E-mails** : `d.bougreau@lyceemarcelcallo.org` (campagne), `i.belaud@lyceemarcelcallo.org` (RGPD)
- [ ] **Nom du signataire** : « Damien BOUGREAU, Responsable de la régie publicitaire »
- [ ] **Photo** : `assets/email-damien.jpg` — vérifier que la photo est celle que vous voulez voir dans l'email

## 4. À vérifier — offre et prix

- [ ] Encart 1/6 : **320 €** · 1/4 : **400 €** · 1/2 : **650 €**
- [ ] Pack 1/6 : **400 €** · Pack 1/4 : **480 €** · Pack 1/2 : **700 €**
- [ ] Formulation du pack : « encart + logo sur le kakemono 2027, à tarif préférentiel »
- [ ] Paiement : « en 1, 2 ou 3 fois »
- [ ] Date limite de réservation : **01/12/2026**
- [ ] Parution : **18/12/2026**
- [ ] **Contradiction à arbitrer** : la plaquette demande les éléments « 15 jours ouvrés avant parution » (= 27/11), soit **avant** la date limite de réservation. Proposition : « sous 5 jours ouvrés après réservation, au plus tard le 11/12/2026 »
- [ ] **CGV V2.3** : ne mentionnent pas la date limite de réservation — un article en V2.4 la sécuriserait

## 5. À vérifier — contenu éditorial

- [ ] Titre de la page d'accueil : « Réservez votre place parmi les partenaires de Callo. »
- [ ] Chiffres de preuve : **2 500 exemplaires**, **10 000 prises en main/an**, **70 km**, **200 entreprises depuis 2009**, **400 encarts** — tous issus de la plaquette V2.6, aucun chiffre inventé
- [ ] Les 5 raisons de l'email (aucune formulation ne promet un résultat commercial)
- [ ] Aucune mention d'IA, aucun nom de prestataire, dans aucun document
- [ ] Orthographe, accents et majuscules (Marcel Callo, Actualycée, kakemono)

## 6. À vérifier — conformité et données

- [ ] Case RGPD du formulaire : obligatoire, avec les droits d'accès et de suppression
- [ ] Mention de l'email : « Vous recevez ce message en tant que professionnel… » + lien de désinscription
- [ ] Base légale de la liste : opt-in B2B ou intérêt légitime documenté
- [ ] Registre RGPD : ajouter la mesure d'audience (durée de visite, navigateur, appareil)
- [ ] Inscription du traitement auprès du référent RGPD de l'établissement
- [ ] Bouton « Se désinscrire » testé

## 7. À vérifier — suivi (onglet Suivi, 55 colonnes)

**Identité et campagne** — E-mail, Entreprise, Nom, Prénom, Fonction, Téléphone

**Jalons email** — Date envoi, Date ouverture, Date clic, Date 1re visite site

**Réponse** — Date réponse formulaire, Intérêt, Formats choisis, Raison (si non), RGPD opt-in

**Documents** — Date DL plaquette, Date DL CGV, Date DL bon de commande, Variante bon de commande, Date réception bon de commande, Date réception encart, Date réception logo, **Date réception BAT signé**, **Date mise sous Drive BC**, **Date mise sous Drive BAT**, Dossier Drive

**Saisie manuelle** — Date envoi devis, Date envoi BAT, Date validation BAT, Montant net €

**Analyse** — Commentaire partenaire, Statut, Dernière activité, Etat e-mail, Canal, Source, Page d'entrée, Referrer, Premier contact, Délai clic→réponse (h), Délai réponse→BC (j), Délai BC→documents (j), Délai documents→BAT (j), Score engagement

**Comportement de visite** — Connexion (jour/heure), Navigateur, Appareil, Écran, Durée de visite (s), Pages vues, Dernière page vue, Nom dossier Drive

**Contrôle de présence dans Drive** — Fichiers présents dans Drive (résumé `BC ✓ · Encart ✓ · Logo ✓ · BAT ✓`), Dernier contrôle Drive

- [ ] Vous êtes d'accord sur le fait que les colonnes « (manuel) » se saisissent à la main
- [ ] Vous êtes d'accord sur le score d'engagement (0–100) et sa pondération
- [ ] Vous êtes d'accord pour mesurer le temps passé, le navigateur et l'appareil (mention RGPD ci-dessus)
- [ ] **Date de mise sous Drive** : elle est écrite automatiquement, à partir de la date réelle de création du fichier dans le dossier (`Date mise sous Drive BC` et `Date mise sous Drive BAT`)
- [ ] **Contrôle de présence** : le menu *Régie Callo → Contrôler les fichiers réellement présents dans Drive* vérifie que le bon de commande et le BAT sont bien dans le dossier, et écrit le résultat (`BC ✓ · BAT ✓`)

## 8. Ce qui n'est pas encore actif

- [ ] **Le site est en mode démonstration** tant que l'URL du script Google n'est pas collée dans `js/config.js` : le parcours s'affiche, **rien n'est enregistré**
- [ ] **Partage Drive** : limité à `d.bougreau@lyceemarcelcallo.org` pour l'instant. `i.belaud@lyceemarcelcallo.org` s'ajoute **après votre vérification**, en une ligne :

```js
SHARE_FOLDER_WITH: ['d.bougreau@lyceemarcelcallo.org', 'i.belaud@lyceemarcelcallo.org'],
```

- [ ] **Webhook Brevo** non créé : les colonnes envoi / ouverture / clic restent vides tant qu'il n'existe pas
- [ ] **Domaine d'envoi** non authentifié : Brevo affichera « via brevo.com » jusqu'à l'ajout du SPF et du DKIM chez OVH
- [ ] **Adresse définitive** : le site tourne aujourd'hui sur `damsmindset.github.io/callo` ; le dépôt `Regiepubcallo.github.io` est créé mais vide

## 9. Décisions à prendre

1. Domaine principal ou sous-domaine `regie.` pour l'envoi ?
2. Correction de la contradiction des 15 jours ouvrés : quelle formulation retenez-vous ?
3. Le pack est-il vendu « encart + logo » ou « encart + logo + kakemono papier » ?
4. Ajout de `i.belaud` au partage Drive : oui / non / plus tard
5. Objet de l'email : version courte (43 caractères) ou version longue (61) ?

---

## 10. Ordre de mise en service

1. Valider ce document
2. Uploader les fichiers sur `Regiepubcallo.github.io`, activer Pages
3. Créer le Google Sheet, coller `Code.gs`, exécuter `setup`, déployer en application web
4. Coller l'URL `/exec` et le jeton dans `js/config.js`
5. Authentifier le domaine dans Brevo (SPF + DKIM chez OVH)
6. Coller l'email dans Brevo, envoyer un test, vérifier sur mobile
7. Créer le webhook Brevo
8. Envoi principal
