import 'dotenv/config';
import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import User from '../models/User.js';
import { hashPassword, validateRegistrationInput } from '../services/auth.js';

const { stdin, stdout } = process;

async function askVisibleDetails() {
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    return {
      name: await prompt.question('Administrator name: '),
      email: await prompt.question('Administrator email: ')
    };
  } finally {
    prompt.close();
  }
}

function askMasked(label) {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal so the password can be entered securely.');
  }
  readline.emitKeypressEvents(stdin);
  stdout.write(label);
  const previousRawMode = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {
      stdin.removeListener('keypress', onKeypress);
      stdin.setRawMode(Boolean(previousRawMode));
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onKeypress = (text, key) => {
      if (key?.ctrl && key.name === 'c') return finish(new Error('Administrator creation cancelled.'));
      if (key?.name === 'return' || key?.name === 'enter') return finish();
      if (key?.name === 'backspace') {
        if (value) {
          value = value.slice(0, -1);
          stdout.write('\b \b');
        }
        return;
      }
      if (!key?.ctrl && !key?.meta && text && !/[\x00-\x1f\x7f]/.test(text)) {
        value += text;
        stdout.write('*'.repeat([...text].length));
      }
    };
    stdin.on('keypress', onKeypress);
  });
}

let connected = false;
try {
  const details = await askVisibleDetails();
  const password = await askMasked('Password (8–72 characters): ');
  const confirmation = await askMasked('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match. No account was created.');

  const input = validateRegistrationInput({ ...details, password });
  await connectDatabase(process.env.MONGO_URI);
  connected = true;
  if (await User.exists({ email: input.email })) {
    throw new Error('An account with that email already exists. No account was changed.');
  }
  await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: 'admin'
  });
  console.log(`Administrator account created for ${input.email}.`);
} catch (error) {
  if (error?.code === 11000) console.error('An account with that email already exists. No account was changed.');
  else console.error(error instanceof Error ? error.message : 'Administrator creation failed.');
  process.exitCode = 1;
} finally {
  if (connected) await mongoose.disconnect();
}
