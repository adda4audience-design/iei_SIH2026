// @ts-nocheck
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { AuditAction } from '@prisma/client';

const generateToken = (id: string, email: string, role: string) => {
  return jwt.sign(
    { id, email, role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
};

const logAudit = async (
  userId: string | null,
  action: AuditAction,
  metadata?: object,
  req?: Request
) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        metadata: metadata as any,
        ipAddress: req?.ip,
        userAgent: req?.headers['user-agent'],
      },
    });
  } catch (e) {
    logger.error('Audit log failed:', e);
  }
};

// ─── Validation Rules ─────────────────────────────────────────

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['OFFICER', 'INSTITUTE', 'ADMIN']).withMessage('Invalid role'),
];

export const registerInstituteValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').notEmpty().trim(),
  body('code').notEmpty().trim(),
  body('type').notEmpty().trim(),
  body('address').notEmpty().trim(),
  body('city').notEmpty().trim(),
  body('state').notEmpty().trim(),
  body('pincode').matches(/^\d{6}$/).withMessage('Valid 6-digit pincode required'),
  body('contactName').notEmpty().trim(),
  body('contactPhone').matches(/^\d{10}$/).withMessage('Valid 10-digit phone required'),
];

// ─── Controllers ──────────────────────────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { email, password, role } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { officer: true, institute: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (user.role !== role) {
      res.status(401).json({ error: 'Invalid credentials for this portal' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id, user.email, user.role);

    await logAudit(user.id, AuditAction.LOGIN, { role: user.role }, req);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.officer || user.institute,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const registerInstitute = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const {
    email, password, name, code, type,
    address, city, state, pincode, contactName, contactPhone,
  } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const codeExists = await prisma.institute.findUnique({ where: { code } });
    if (codeExists) {
      res.status(409).json({ error: 'Institution code already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'INSTITUTE',
        institute: {
          create: {
            name, code, type, address, city, state, pincode,
            contactName, contactPhone,
          },
        },
      },
      include: { institute: true },
    });

    const token = generateToken(user.id, user.email, user.role);

    await logAudit(user.id, AuditAction.USER_CREATED, { role: 'INSTITUTE', instituteCode: code }, req);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.institute,
      },
    });
  } catch (error) {
    logger.error('Register institute error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { officer: true, institute: true },
      omit: { passwordHash: true } as any,
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      profile: user.officer || user.institute,
    });
  } catch (error) {
    logger.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  await logAudit(req.user?.id || null, AuditAction.LOGOUT, {}, req);
  res.json({ message: 'Logged out successfully' });
};
