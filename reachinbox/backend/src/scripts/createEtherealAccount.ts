// Run: npx ts-node src/scripts/createEtherealAccount.ts
// This creates a FREE fake SMTP inbox on Ethereal and prints credentials
// you can paste into a sender row (see seedSenders.ts).
import nodemailer from "nodemailer";

async function main() {
  const account = await nodemailer.createTestAccount();
  console.log("✅ Ethereal test account created:");
  console.log({ user: account.user, pass: account.pass });
  console.log("Copy these into src/scripts/seedSenders.ts, then run: npm run seed");
}
main();
