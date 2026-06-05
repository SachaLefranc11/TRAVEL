/**
 * Applique les migrations Prisma avec plusieurs tentatives.
 *
 * Raison : sur Neon (tier gratuit), le compute se met en veille après quelques
 * minutes d'inactivité. Lors d'un déploiement, la 1re connexion peut échouer
 * (P1001) le temps que la base se réveille. On réessaie donc quelques fois
 * avant d'abandonner, ce qui évite de faire planter tout le déploiement.
 */
const { execSync } = require('child_process');

const MAX_ATTEMPTS = 5;
const DELAY_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[migrate] Tentative ${attempt}/${MAX_ATTEMPTS}…`);
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('[migrate] Migrations appliquées ✅');
      return;
    } catch {
      console.warn(`[migrate] Échec tentative ${attempt} (base peut-être en veille).`);
      if (attempt < MAX_ATTEMPTS) {
        console.log(`[migrate] Nouvelle tentative dans ${DELAY_MS / 1000}s…`);
        await sleep(DELAY_MS);
      } else {
        console.error('[migrate] Toutes les tentatives ont échoué.');
        process.exit(1);
      }
    }
  }
}

main();
