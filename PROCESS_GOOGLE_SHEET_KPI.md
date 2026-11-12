# Process — Google Sheet de suivi KPI (Régie Callo 2027)

Objectif : un fichier Google Sheet qui enregistre **chaque** visite, réponse, téléchargement,
dépôt et événement d'e-mail, calcule les taux et montre **d'où viennent les contacts** et
**où le parcours partenaire bloque**.

Temps réel : **25 à 35 minutes**, une seule fois. Compte Google de Damien.

---

## Ce que le fichier contient (4 onglets, créés automatiquement)

| Onglet | Rôle | Remplissage |
|---|---|---|
| **Suivi** | 1 ligne par contact, 54 colonnes : coordonnées, jalons datés, provenance, délais, score, statut | automatique (site + Brevo), sauf les 4 colonnes « (manuel) » |
| **Journal** | chaque événement horodaté (visite, réponse, clic, dépôt, erreur) | automatique |
| **Tableau de bord** | volumes, taux d'ouverture / clic / conversion, CA, panier moyen, délais moyens | formules |
| **Parcours** | entonnoir en 10 étapes, **provenance par canal**, délais mesurés, points de friction | formules |

### Les colonnes d'analyse ajoutées (remplissage automatique)

- **Canal** — `Emailing — envoi principal`, `Emailing — relance 1`, `Emailing — dernier mail`,
  `Site direct / recherche`, `QR code / support imprimé`…
- **Source** — le code brut (`email1`, `relance1`, `direct`, `qr`…).
- **Page d'entrée** et **Referrer** — d'où vient la visite (ex. `mail.google.com`, `direct`).
- **Premier contact** — date de la première trace.
- **Délai clic→réponse (h)**, **Délai réponse→BC (j)**, **Délai BC→documents (j)**,
  **Délai documents→BAT (j)** — les 4 temps du parcours.
- **Score engagement** (0–100) — ouverture 10, clic 15, visite 10, réponse 25, BC téléchargé 10,
  BC reçu 15, dossier complet 10, BAT validé 5.
- **Etat e-mail** — rebond, blocage, désinscription (jamais écrasé par le statut commercial).

### Comportement de visite (mesuré dans le navigateur du partenaire)

- **Connexion (jour/heure)** — date et heure exactes de la première connexion.
- **Navigateur** — Chrome, Safari, Firefox, Edge, Opera, Samsung (avec le numéro de version).
- **Appareil** — Mobile, Tablette ou Ordinateur.
- **Écran** — résolution (`390x844` par exemple).
- **Durée de visite (s)** — temps réellement passé, onglet actif. Le compteur **s'arrête
  quand l'onglet passe en arrière-plan** : on mesure l'attention, pas la fenêtre ouverte.
  Envoi toutes les 45 s et à la fermeture, cumul côté serveur, donc pas de double comptage.
- **Pages vues** — nombre de pages visitées dans la session.
- **Dernière page vue** — là où le partenaire s'est arrêté : c'est le signal de friction le plus utile.
- **Nom dossier Drive** — nom du dossier créé pour l'entreprise, qui reçoit ses fichiers.

> Confidentialité : ces mesures sont **agrégées sur le contact** (pas de cookie publicitaire,
> pas de revente, pas de traçage hors du site). Elles servent uniquement au suivi de la
> campagne interne. Mention à ajouter au registre RGPD de l'établissement.

---

## Étape 1 — Créer le fichier (1 min)

1. Dans Google Drive, **Nouveau → Google Sheets → Fichier vide**.
2. Renommer : **Suivi régie Callo 2027**.

## Étape 2 — Coller le script (3 min)

1. Dans la feuille : **Extensions → Apps Script**.
2. Sélectionner tout le code présent (`Ctrl+A`) et le supprimer.
3. Ouvrir `apps-script/Code.gs` du dossier livré, **tout** copier, coller.
4. En haut du code, vérifier le bloc `CONFIG` :

```js
var CONFIG = {
  TOKEN: 'callo2027-nQ7xW2',                        // doit être identique à js/config.js
  NOTIFY_EMAIL: 'd.bougreau@lyceemarcelcallo.org',  // alertes réponses / dépôts
  ...
```

> Le `TOKEN` est déjà aligné avec `js/config.js` du site. Si vous le changez ici,
> changez-le aussi dans `js/config.js` sur GitHub — sinon le site reçoit « Non autorisé ».

5. **Enregistrer** (icône disquette).

## Étape 3 — Initialiser (2 min)

1. En haut de l'éditeur, dans la liste des fonctions, choisir **`setup`**, cliquer **Exécuter**.
2. Google demande les autorisations → **Autoriser** avec le compte propriétaire.
   Si « Application non vérifiée » : **Paramètres avancés → Accéder à … (non sécurisé)** — c'est votre propre script.
3. Retour dans la feuille : les 4 onglets **Suivi / Journal / Tableau de bord / Parcours** existent.
4. Un menu **« Régie Callo »** apparaît à droite de « Aide ».

> Si les onglets manquent : menu **Régie Callo → Initialiser / réparer les feuilles**.

## Étape 4 — Déployer l'application web (3 min)

1. **Déployer → Nouveau déploiement**.
2. Type : **Application web**.
   - Description : `Régie Callo v2`
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde** ← obligatoire, sinon le site ne peut pas écrire
3. **Déployer**, puis copier l'**URL de l'application web** (elle finit par `/exec`).
4. Contrôle immédiat : coller cette URL dans un navigateur. Vous devez lire
   `{"ok":true,"service":"Régie Callo 2027","version":"v2.0"}`.

## Étape 5 — Brancher le site dessus (2 min)

1. Sur GitHub, ouvrir `js/config.js` → crayon.
2. Coller l'URL dans `APPS_SCRIPT_URL` :

```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfy…/exec",
```

3. **Commit changes**, attendre 1 minute, recharger le site.
4. Tant que ce champ est vide, le site est en **mode démonstration** : le parcours s'affiche,
   mais **rien n'est enregistré**.

## Étape 6 — Brancher Brevo (5 min)

1. Brevo → **Paramètres → Webhooks** (webhooks marketing) → **Créer**.
2. URL :

```
URL_DU_SCRIPT/exec?k=callo2027-nQ7xW2
```

3. Événements à cocher : **envoyé / délivré, ouvert, clic, rebond, désinscription**.
4. Enregistrer, puis envoyer un e-mail de test : les colonnes *Date envoi*, *Date ouverture*,
   *Date clic* et *Etat e-mail* se remplissent seules.

> Sans webhook, ces trois dates restent dans les statistiques Brevo et le site enregistre
> quand même les visites des contacts venus par le bouton (le lien porte `?e=mail&c=email1`).

## Étape 7 — Vérifier de bout en bout (5 min)

| Test | Ce qui doit apparaître dans **Suivi** |
|---|---|
| Ouvrir `…/?e=votre@mail.fr&c=email1` | ligne créée, **Canal = Emailing — envoi principal**, *Date 1re visite* remplie |
| Ouvrir `…/` sans paramètre puis remplir le formulaire | **Canal = Site direct / recherche**, *Referrer* renseigné |
| Remplir le formulaire (Oui + un format) | Entreprise, nom, intérêt, formats, RGPD ; alerte e-mail reçue ; **Statut = 4 · Oui, à convertir** |
| Télécharger la plaquette et le bon de commande | *Date DL plaquette*, *Date DL bon de commande*, *Variante bon de commande* |
| Déposer BC + encart + logo | 3 dates de réception, lien **Dossier Drive**, accusé de réception reçu |
| Écrire un commentaire | *Commentaire partenaire* horodaté |
| Onglet **Parcours** | entonnoir à jour, ligne *Emailing — envoi principal* avec 1 contact |
| Rester 30 s sur une page puis fermer l'onglet | *Durée de visite* > 0, *Navigateur* et *Appareil* renseignés |
| Déposer les 3 fichiers | dossier Drive **au nom de l'entreprise**, 3 dates de réception sur la même ligne |

## Étape 7 bis — Dépôts, BAT et partage Google Drive

**Où arrivent les fichiers.** Le script s'exécute avec le compte qui le déploie : les fichiers
atterrissent donc dans le Drive de **d.bougreau@lyceemarcelcallo.org**, dans le dossier
`Régie Callo 2027 - Dépôts partenaires`, avec **un sous-dossier par entreprise**.

Nommage automatique : `encart_Entreprise_20261201-1430_fichier.pdf`.
Vous obtenez donc, pour chaque partenaire, un dossier qui contient son bon de commande signé,
son encart, son logo et — s'il l'a renvoyé — **son BAT signé**.

**Les 4 types de fichiers acceptés**

| Champ | Obligatoire | Formats | Nom dans le dossier |
|---|---|---|---|
| Bon de commande signé | oui | PDF | `bon-de-commande_…` |
| Encart | oui | PDF, PNG, JPG | `encart_…` |
| Logo | oui | AI, EPS, SVG, PDF, PNG | `logo_…` |
| BAT signé | non | PDF, JPG, PNG | `bat-signe_…` |

**Partage du Drive.** Ouvrez le menu **Régie Callo → Préparer et partager le dossier Drive**.
Le dossier racine et chaque dossier d'entreprise sont partagés en **lecture seule** avec les
personnes listées dans le script :

```js
SHARE_FOLDER_WITH: ['d.bougreau@lyceemarcelcallo.org', 'i.belaud@lyceemarcelcallo.org'],
SHARE_WITH_DOMAIN: false,   // true = tout le domaine lyceemarcelcallo.org en lecture
```

- Le partage n'est appliqué **qu'une fois par dossier** (marqueur dans la description du
  dossier), donc pas de notifications répétées.
- Le lien direct vers le dossier du partenaire est écrit dans la colonne **Dossier Drive**, et
  son nom dans **Nom dossier Drive**.
- Avec `SHARE_WITH_DOMAIN: true`, tout le domaine voit les dossiers : à n'activer que si
  l'établissement l'autorise, car les dossiers contiennent des documents commerciaux.

**Suivi du BAT dans la feuille**

| Événement | Colonne remplie | Statut |
|---|---|---|
| BAT envoyé au partenaire | *Date envoi BAT (manuel)* | 8 · BAT envoyé, à valider |
| Partenaire renvoie le BAT signé (dépôt) | *Date réception BAT signé* + *Date mise sous Drive BAT* | 9 · BAT signé reçu |
| Validation notée à la main | *Date validation BAT (manuel)* | 10 · BAT signé reçu — dossier bouclé |

L'onglet **Parcours** ajoute l'étape **11 · BAT signé reçu**, et le tableau de bord les lignes
*BAT signés reçus*, *Dossiers avec BC dans Drive* et *Dossiers avec BAT dans Drive*.

**Preuve que le fichier est bien dans Drive.** Deux colonnes dédiées :

- **Date mise sous Drive BC** et **Date mise sous Drive BAT** — écrites à l'instant du dépôt,
  puis corrigées avec la **date de création réelle du fichier** au contrôle suivant.
- **Fichiers présents dans Drive** — résumé `BC ✓ · Encart ✓ · Logo ✓ · BAT ✓`, et
  **Dernier contrôle Drive** — horodatage de la dernière vérification.

Menu **Régie Callo → Contrôler les fichiers réellement présents dans Drive** : balaye tous les
contacts, ouvre chaque dossier d'entreprise, vérifie la présence réelle des quatre fichiers et
met à jour les dates. À lancer une fois par jour pendant la période de collecte : c'est la
garantie qu'une ligne du tableur correspond à un document réellement stocké.

## Étape 8 — Après toute modification du script

**Déployer → Gérer les déploiements → crayon → Version : Nouvelle version → Déployer.**
Sans cela, l'ancienne version continue de tourner et vos corrections n'ont aucun effet.

---

## Comment lire le suivi (routine de 5 minutes)

**Une fois par jour, onglet Tableau de bord :**

1. *E-mails ouverts / envoyés* → qualité de l'objet.
2. *Clics / envoyés* → qualité du contenu et du bouton.
3. *Réponses / contacts* → efficacité du formulaire.
4. *dont Oui / réponses* → qualité de la cible.
5. *Délai moyen réception → BAT* → tient-on la promesse des 3 jours ouvrés ?

**Deux fois par semaine, onglet Parcours :**

1. La **ligne de friction** désigne l'étape qui perd le plus de monde. C'est là qu'on agit,
   pas ailleurs.
2. Bloc **Provenance** : comparer le taux de réponse des canaux. Un canal qui amène des
   visites sans réponses = message ou page à retravailler.
3. Bloc **Délais** : si *Réponse → BC* dépasse 7 jours, relancer plus tôt.

**Chaque vendredi, 3 lignes de décision :** ce qui a marché, ce qui bloque, ce qu'on change
la semaine suivante.

---

## Garde-fous

- Le `TOKEN` visible dans le code du site n'est **pas** une authentification : il bloque les
  envois automatisés banals. Il ne protège pas les données.
- Le fichier contient des **données personnelles** : partage nominatif uniquement, jamais de
  lien « public ».
- Sauvegarde : **Fichier → Créer une copie** chaque vendredi, et une copie hors Google Drive
  (téléchargement `.xlsx`) une fois par mois. Deux copies, jamais au même endroit.
- Dépôts de fichiers : 20 Mo maximum par envoi (limite Apps Script). Au-delà, le partenaire
  écrit à Damien.
