#!/usr/bin/env node

/**
 * Miko Admin Panel - Super Admin Setup Script
 * 
 * This script helps you generate a secure password hash for the Super Admin account.
 * Run: node scripts/generate-admin-hash.js
 */

import bcryptjs from 'bcryptjs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n==============================================');
  console.log('  Miko Admin Panel - Super Admin Setup');
  console.log('==============================================\n');

  console.log('This script will help you generate a secure password hash');
  console.log('for your Super Admin account.\n');

  const username = await question('Enter Super Admin username (default: superadmin): ');
  const finalUsername = username.trim() || 'superadmin';

  console.log('\n⚠️  Password Requirements:');
  console.log('   - Minimum 12 characters recommended');
  console.log('   - Use a mix of uppercase, lowercase, numbers, and symbols');
  console.log('   - This password is for platform administration only\n');

  const password = await question('Enter Super Admin password: ');

  if (password.length < 8) {
    console.log('\n❌ Error: Password must be at least 8 characters long.');
    rl.close();
    process.exit(1);
  }

  const confirmPassword = await question('Confirm password: ');

  if (password !== confirmPassword) {
    console.log('\n❌ Error: Passwords do not match.');
    rl.close();
    process.exit(1);
  }

  console.log('\n⏳ Generating secure hash (this may take a moment)...\n');

  const hash = await bcryptjs.hash(password, 12);

  console.log('✅ Hash generated successfully!\n');
  console.log('==============================================');
  console.log('Add these to your .env file:');
  console.log('==============================================\n');
  console.log(`SUPER_ADMIN_USERNAME=${finalUsername}`);
  console.log(`SUPER_ADMIN_PASSWORD_HASH=${hash}`);
  console.log('\n==============================================\n');

  console.log('⚠️  IMPORTANT SECURITY NOTES:');
  console.log('   1. Never commit your .env file to version control');
  console.log('   2. Store this password securely (password manager recommended)');
  console.log('   3. The hash above is safe to store in environment variables');
  console.log('   4. Restart your backend server after updating .env\n');

  rl.close();
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
