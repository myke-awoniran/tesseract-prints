import crypto from 'node:crypto';
import type { Role } from '@tesseract/shared';
import { connectDb, disconnectDb } from '../db.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';

const password = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString('base64url');
const ownerEmail = (process.env.SEED_OWNER_EMAIL || 'owner@demo-chambers.ng').toLowerCase();
const operatorEmail = (process.env.SEED_OPERATOR_EMAIL || 'operator@tesseractprints.ng').toLowerCase();

await connectDb({ info: () => {} });

let org = await Organization.findOne({ name: 'Demo Chambers' });
if (!org) {
  org = await Organization.create({
    name: 'Demo Chambers',
    billingEmail: ownerEmail,
    defaultDelivery: { recipientName: 'Front desk', phone: '+234 800 000 0000', address: '12 Example Crescent', area: 'Maitama' }
  });
}

async function upsertUser(input: { email: string; name: string; role: Role; organization: string | null }) {
  let user = await User.findOne({ email: input.email });
  if (!user) user = new User(input);
  user.role = input.role;
  user.organization = input.organization;
  await user.setPassword(password);
  await user.save();
  return user;
}

await upsertUser({ email: ownerEmail, name: 'Adaeze Okafor', role: 'owner', organization: org._id });
await upsertUser({ email: operatorEmail, name: 'Print Room', role: 'operator', organization: null });

console.log('\nSeed complete. Sign in at /console/login with:');
console.log(`  Client owner: ${ownerEmail}`);
console.log(`  Operator:     ${operatorEmail}`);
console.log(`  Password:     ${password}\n`);

await disconnectDb();
