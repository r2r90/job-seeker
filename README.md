# linkedin-job-notifier

Scrute automatiquement les offres LinkedIn toutes les 15 minutes via RapidAPI et envoie une notification email pour chaque nouvelle offre correspondant à vos critères.

## Architecture

```
src/
├── main.ts
├── app.module.ts
├── linkedin/
│   ├── linkedin.interface.ts   # Type LinkedinJob
│   ├── linkedin.service.ts     # Appels RapidAPI
│   └── linkedin.module.ts
├── email/
│   ├── email.service.ts        # Envoi Nodemailer (HTML + texte)
│   └── email.module.ts
└── scheduler/
    ├── scheduler.service.ts    # CronJob 15 min + déduplication (Set)
    └── scheduler.module.ts
```

## Prérequis

- Node.js 20+
- Un compte [RapidAPI](https://rapidapi.com) avec l'API **LinkedIn Jobs Search** souscrite
- Un compte SMTP (Gmail recommandé avec un mot de passe d'application)

## Installation

```bash
# 1. Cloner / copier le projet
cd linkedin-job-notifier

# 2. Copier et remplir le fichier d'environnement
cp .env.example .env
# → éditer .env avec vos valeurs

# 3. Installer les dépendances
npm install

# 4. Démarrer en développement
npm run start:dev
```

## Variables d'environnement

| Variable          | Description                                      | Exemple                        |
|-------------------|--------------------------------------------------|--------------------------------|
| `RAPIDAPI_KEY`    | Clé RapidAPI pour LinkedIn Jobs Search           | `abc123...`                    |
| `SEARCH_KEYWORDS` | Mots-clés de la recherche                        | `Full Stack Developer Node.js` |
| `SEARCH_LOCATION` | Localisation de la recherche                     | `Paris, France`                |
| `SMTP_HOST`       | Serveur SMTP                                     | `smtp.gmail.com`               |
| `SMTP_PORT`       | Port SMTP (587 = STARTTLS, 465 = SSL)            | `587`                          |
| `SMTP_USER`       | Adresse email d'envoi                            | `you@gmail.com`                |
| `SMTP_PASS`       | Mot de passe SMTP / mot de passe d'application   | `xxxx xxxx xxxx xxxx`          |
| `NOTIFY_EMAIL`    | Adresse email de destination des notifications   | `aghartur@gmail.com`           |

### Gmail — mot de passe d'application

1. Activer la validation en deux étapes sur votre compte Google
2. Aller dans **Compte Google → Sécurité → Mots de passe des applications**
3. Créer un mot de passe pour "Mail / Autre" et copier la clé dans `SMTP_PASS`

## Lancement avec Docker

```bash
# Construire et démarrer
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down
```

## Fonctionnement

1. Au démarrage, le `SchedulerService` enregistre un `CronJob` qui se déclenche **toutes les 15 minutes**.
2. `LinkedinService.searchJobs()` interroge l'API RapidAPI avec `SEARCH_KEYWORDS` et `SEARCH_LOCATION`.
3. Seules les offres dont l'`id` n'est pas encore dans le `Set<string>` interne sont considérées comme nouvelles.
4. `EmailService.sendJobNotification()` envoie un email HTML récapitulatif.
5. Les IDs des offres envoyées sont ajoutés au `Set` pour éviter les doublons.

> **Note :** le `Set` est en mémoire — il se réinitialise au redémarrage. Pour une persistance entre redémarrages, envisagez de remplacer le `Set` par un fichier JSON ou une base de données légère (SQLite, Redis).

## Build production

```bash
npm run build
npm run start:prod
```
