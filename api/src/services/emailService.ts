// Brevo (ex-Sendinblue) transactional email service.
// Plano gratuito: 300 emails/dia, sem domínio próprio obrigatório.
//
// ─── LIMITES (fácil de alterar quando migrar para plano pago) ────────
// DAILY_SEND_LIMIT: máximo de emails enviados por dia (Brevo free = 300)
// MAX_GROUP_SIZE: máximo de contatos por grupo de newsletter
// Quando contratar plano pago ou domínio próprio, basta alterar aqui.
// ─────────────────────────────────────────────────────────────────────

/** Limite diário de envios — Brevo free tier = 300/dia */
export const DAILY_SEND_LIMIT = 300;

/** Tamanho máximo de um grupo de contatos */
export const MAX_GROUP_SIZE = 300;

const BREVO_API_URL = 'https://api.brevo.com/v3';

interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: { email: string; name?: string }[];
  bcc?: { email: string }[];
  subject: string;
  htmlContent: string;
}

async function brevoRequest(path: string, body: unknown): Promise<unknown> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');

  const res = await fetch(`${BREVO_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// Sender: usa email pessoal verificado no Brevo (sem domínio próprio).
// Quando tiver domínio, basta trocar BREVO_SENDER_EMAIL no .env.
function getSender() {
  const email = process.env.BREVO_SENDER_EMAIL;
  if (!email) throw new Error('BREVO_SENDER_EMAIL not set — use seu email verificado no Brevo');
  return {
    name: process.env.BREVO_SENDER_NAME ?? 'Quartinho',
    email,
  };
}

// ─── Controle diário de envios ──────────────────────────────────────
// Contador em memória — reseta quando o processo reinicia.
// Para persistência real, trocar por Firestore counter.
let dailySentCount = 0;
let dailyResetDate = new Date().toDateString();

function checkDailyLimit(count: number): void {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailySentCount = 0;
    dailyResetDate = today;
  }
  if (dailySentCount + count > DAILY_SEND_LIMIT) {
    throw new Error(
      `Limite diário de ${DAILY_SEND_LIMIT} emails atingido. ` +
      `Já enviados hoje: ${dailySentCount}. Tentando enviar: ${count}. ` +
      `Tente novamente amanhã ou migre para plano pago.`,
    );
  }
}

function incrementDailyCount(count: number): void {
  dailySentCount += count;
}

/** Retorna quantos emails ainda podem ser enviados hoje. */
export function getDailyRemaining(): number {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) return DAILY_SEND_LIMIT;
  return Math.max(0, DAILY_SEND_LIMIT - dailySentCount);
}

/** Send a single transactional email. */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  checkDailyLimit(1);
  const payload: BrevoEmailPayload = {
    sender: getSender(),
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };
  await brevoRequest('/smtp/email', payload);
  incrementDailyCount(1);
}

/**
 * Send bulk emails via BCC — uma única chamada à API.
 * Ninguém vê o email dos outros. Brevo aceita até 2000 bcc por chamada.
 */
export async function sendBulk(
  recipients: string[],
  subject: string,
  html: string,
): Promise<number> {
  if (!recipients.length) return 0;
  checkDailyLimit(recipients.length);
  const sender = getSender();

  const BCC_BATCH_SIZE = 2000;
  let sent = 0;
  for (let i = 0; i < recipients.length; i += BCC_BATCH_SIZE) {
    const batch = recipients.slice(i, i + BCC_BATCH_SIZE);
    const payload: BrevoEmailPayload = {
      sender,
      to: [{ email: sender.email }],
      bcc: batch.map((email) => ({ email })),
      subject,
      htmlContent: html,
    };
    await brevoRequest('/smtp/email', payload);
    sent += batch.length;
    incrementDailyCount(batch.length);
  }
  return sent;
}

// ─── Design tokens do site (tailwind.config.js) ────────────────────
// Cores: periwinkle=#8B9FD4, cream=#F5F5DC, burntYellow=#E8A42C,
//        burntOrange=#D97642, mint=#98D9C2
// Fontes: Alfa Slab One (display), Bitter (body), fallback Georgia
// Border: 4px solid cream (como ZineFrame)
// ────────────────────────────────────────────────────────────────────

const COLORS = {
  periwinkle: '#8B9FD4',
  cream: '#F5F5DC',
  burntYellow: '#E8A42C',
  burntOrange: '#D97642',
  mint: '#98D9C2',
  text: '#1A1A1A',
  textMuted: '#5a5a5a',
} as const;

// Logo PNG hospedado no Firebase Hosting (96x96).
// SVG inline não funciona em Gmail/Outlook — PNG via <img> é o padrão.
// Se mudar o domínio, atualizar FRONTEND_URL no .env.
function getLogoUrl(): string {
  const frontendUrl = process.env.FRONTEND_URL ?? 'https://teste-qbh.web.app';
  return `${frontendUrl}/logo-email.png`;
}

// ─── Template helpers ───────────────────────────────────────────────
// Mobile-first, HTML simples, funciona em Gmail/Outlook/Apple Mail.
// Espelha o visual do site: header periwinkle, body cream, footer mint,
// borders cream 4px, fontes Bitter/Georgia.

function getUrls() {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return { apiUrl, frontendUrl };
}

/** Header compartilhado — periwinkle bg, logo + nome (igual ao Header.tsx) */
function emailHeader(): string {
  const logoUrl = getLogoUrl();
  return `
    <div style="background:${COLORS.periwinkle};padding:16px 24px;text-align:center;border-bottom:4px solid ${COLORS.cream};">
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${logoUrl}" alt="Quartinho" width="44" height="44" style="display:block;border:0;" />
          </td>
          <td style="vertical-align:middle;">
            <span style="color:${COLORS.cream};font-size:24px;font-weight:bold;letter-spacing:0.5px;font-family:Georgia,serif;">
              Quartinho
            </span>
          </td>
        </tr>
      </table>
    </div>`;
}

/** Footer compartilhado — mint bg (igual ao Footer.tsx) */
function emailFooter(opts: { unsubscribe?: boolean } = {}): string {
  const { apiUrl } = getUrls();
  const unsubscribeUrl = `${apiUrl}/email/unsubscribe`;

  return `
    <div style="background:${COLORS.mint};padding:14px 24px;text-align:center;border-top:4px solid ${COLORS.cream};">
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;width:100%;">
        <tr>
          <td style="text-align:left;font-size:12px;color:${COLORS.cream};font-family:Georgia,serif;">
            quartinho &middot; desde 2023
          </td>
          <td style="text-align:right;font-size:12px;font-family:Georgia,serif;">
            <a href="https://www.instagram.com/quartinhobh/" style="color:${COLORS.cream};text-decoration:underline;">@quartinhobh</a>
          </td>
        </tr>
        ${opts.unsubscribe ? `
        <tr>
          <td colspan="2" style="text-align:center;padding-top:8px;">
            <a href="${unsubscribeUrl}" style="font-size:11px;color:${COLORS.cream};opacity:0.7;text-decoration:underline;">
              Cancelar inscrição
            </a>
          </td>
        </tr>` : ''}
      </table>
    </div>`;
}

/** Botão estilizado — burntYellow bg, cream text (igual ao Button.tsx) */
function emailButton(text: string, href: string): string {
  return `
    <div style="text-align:center;margin:24px 0;">
      <a href="${href}" style="
        display:inline-block;padding:14px 32px;
        background:${COLORS.burntYellow};color:${COLORS.cream};
        text-decoration:none;border:4px solid ${COLORS.cream};
        font-weight:bold;font-size:16px;font-family:Georgia,serif;
      ">${text}</a>
    </div>`;
}

/**
 * Template completo com header + body + footer (com unsubscribe).
 * Usar para newsletters e emails gerais.
 */
export function wrapTemplate(body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.cream};">
  <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
  <div style="max-width:600px;margin:0 auto;background:${COLORS.cream};font-family:'Bitter',Georgia,serif;">
    ${emailHeader()}
    <div style="padding:24px;color:${COLORS.text};line-height:1.6;font-size:16px;border-left:4px solid ${COLORS.cream};border-right:4px solid ${COLORS.cream};">
      ${body}
    </div>
    ${emailFooter({ unsubscribe: true })}
  </div>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}

/**
 * Template transacional (sem unsubscribe) — convites, promoções, etc.
 */
export function wrapTransactionalTemplate(body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.cream};">
  <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
  <div style="max-width:600px;margin:0 auto;background:${COLORS.cream};font-family:'Bitter',Georgia,serif;">
    ${emailHeader()}
    <div style="padding:24px;color:${COLORS.text};line-height:1.6;font-size:16px;">
      ${body}
    </div>
    ${emailFooter()}
  </div>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}

/** Email de convite para admin/moderador. */
export function buildRoleInviteEmail(role: string): string {
  const { frontendUrl } = getUrls();
  const roleName = role === 'admin' ? 'administrador' : 'moderador';

  return wrapTransactionalTemplate(`
    <h1 style="color:${COLORS.burntOrange};font-size:24px;margin:0 0 16px;font-family:Georgia,serif;">
      Você foi convidado!
    </h1>
    <p>
      Você recebeu acesso de <strong style="color:${COLORS.burntOrange};">${roleName}</strong> no Quartinho BH.
    </p>
    <p>Para ativar, basta fazer login com este email:</p>
    ${emailButton('Acessar o painel', `${frontendUrl}/admin`)}
    <p style="color:${COLORS.textMuted};font-size:14px;">
      Use sua conta Google ou email+senha para entrar.
      Seus privilégios de ${roleName} já estarão ativos.
    </p>
  `);
}

/** Email de promoção (usuário já existente que foi promovido). */
export function buildRolePromotionEmail(role: string): string {
  const { frontendUrl } = getUrls();
  const roleName = role === 'admin' ? 'administrador' : 'moderador';

  return wrapTransactionalTemplate(`
    <h1 style="color:${COLORS.burntOrange};font-size:24px;margin:0 0 16px;font-family:Georgia,serif;">
      Bem-vindo ao time!
    </h1>
    <p>
      Você foi promovido a <strong style="color:${COLORS.burntOrange};">${roleName}</strong> do Quartinho BH.
    </p>
    ${emailButton('Acessar Painel Admin', `${frontendUrl}/admin`)}
    <p style="color:${COLORS.textMuted};font-size:14px;">
      Faça login com sua conta para acessar as ferramentas de ${roleName}.
    </p>
  `);
}
