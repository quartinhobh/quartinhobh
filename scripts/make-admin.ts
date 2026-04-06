// Promove email a admin no Firestore de produção.
// Uso: bun scripts/make-admin.ts afa7789@gmail.com

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const email = process.argv[2];
if (!email) {
  console.error('Uso: bun scripts/make-admin.ts <email>');
  process.exit(1);
}

// Lê as credenciais do .env.production parseando manualmente
const envPath = resolve(import.meta.dir, '../api/.env.production');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx);
  let val = trimmed.slice(eqIdx + 1);
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  envVars[key] = val;
}

const projectId = envVars.FIREBASE_PROJECT_ID;
const clientEmail = envVars.FIREBASE_CLIENT_EMAIL;
const privateKey = envVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Faltam credenciais em api/.env.production');
  console.error({ projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey });
  process.exit(1);
}

console.log(`Projeto: ${projectId}`);
console.log(`Email: ${email}`);
console.log(`Client: ${clientEmail}`);

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore(app);
const auth = getAuth(app);

// Tenta achar o user no Auth
try {
  const user = await auth.getUserByEmail(email);
  console.log(`Auth user encontrado: uid=${user.uid}`);

  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({ role: 'admin', updatedAt: Date.now() });
    console.log(`✓ users/${user.uid} atualizado para role=admin`);
  } else {
    await ref.set({
      id: user.uid,
      email,
      displayName: user.displayName ?? email,
      role: 'admin',
      linkedSessionId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log(`✓ users/${user.uid} criado com role=admin`);
  }
} catch (e: any) {
  if (e?.code === 'auth/user-not-found') {
    console.log('User não existe no Auth ainda. Criando role_invite...');
    await db.collection('role_invites').doc(email).set({ role: 'admin' });
    console.log(`✓ role_invites/${email} criado — vira admin no próximo login`);
  } else {
    console.error('Erro:', e);
    process.exit(1);
  }
}

process.exit(0);
