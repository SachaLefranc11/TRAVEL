import { Resend } from 'resend';

const API_KEY = process.env.RESEND_API_KEY;
// Expéditeur : domaine vérifié en prod (RESET_FROM_EMAIL), sinon le sandbox Resend.
const FROM = process.env.RESET_FROM_EMAIL ?? 'Travel <onboarding@resend.dev>';

// Client initialisé seulement si une clé est présente — sinon on log (dev).
const resend = API_KEY ? new Resend(API_KEY) : null;

const resetEmailHtml = (resetUrl: string): string => `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#111827;margin:0 0 8px">Réinitialisation de mot de passe</h2>
    <p style="color:#4b5563;font-size:14px;line-height:1.6">
      Vous avez demandé à réinitialiser votre mot de passe Travel. Ce lien expire dans 15 minutes.
    </p>
    <a href="${resetUrl}"
       style="display:inline-block;margin:16px 0;background:#4f46e5;color:#fff;text-decoration:none;
              padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px">
      Réinitialiser mon mot de passe
    </a>
    <p style="color:#9ca3af;font-size:12px;line-height:1.6">
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.
    </p>
  </div>
`;

/**
 * Envoie l'email de réinitialisation. Lève une erreur si l'envoi échoue ;
 * l'appelant décide quoi en faire (le endpoint forgot-password reste générique).
 */
export const sendPasswordResetEmail = async (to: string, resetUrl: string): Promise<void> => {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY manquant — email non envoyé.');
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Email] (dev) Lien de réinitialisation pour ${to} : ${resetUrl}`);
    }
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: 'Réinitialisation de votre mot de passe Travel',
    html: resetEmailHtml(resetUrl),
  });

  if (error) {
    console.error('[Email] Échec envoi Resend :', error);
    throw new Error('EMAIL_SEND_FAILED');
  }
};
