import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/database.js';
import {
  clearSessionCookie,
  createSessionCookie,
  hashPassword,
  passwordMatches,
  signSessionToken,
  toPublicUser,
  validateLoginInput,
  validateRegistrationInput
} from '../services/auth.js';
import { unauthorized } from '../services/errors.js';

const router = Router();

function beginSession(res, user) {
  res.setHeader('Set-Cookie', createSessionCookie(signSessionToken(user._id)));
}

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ message: 'Signed out.' });
});

router.use(requireDatabase);

router.post('/register', async (req, res) => {
  const { name, email, password } = validateRegistrationInput(req.body);
  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: 'customer'
  });
  beginSession(res, user);
  res.status(201).json({ user: toPublicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = validateLoginInput(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.active || !(await passwordMatches(password, user.passwordHash))) {
    throw unauthorized('Email or password is incorrect.');
  }
  user.lastLoginAt = new Date();
  await user.save();
  beginSession(res, user);
  res.json({ user: toPublicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

export default router;
