import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../errors/AppError.js';
import { authenticate, JWT_SECRET } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

/**
 * POST /api/v1/auth/login
 * Authenticates user credentials (Admin or Employee) and returns JWT
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw AppError.badRequest('Email and password are required');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (user.status === 'inactive') {
      throw AppError.forbidden('Your account is inactive. Please contact the administrator.');
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return sendSuccess(res, {
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          designation: user.designation,
          mustChangePassword: user.mustChangePassword,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user's profile
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    return sendSuccess(res, {
      message: 'Current session fetched',
      data: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        designation: user.designation,
        mustChangePassword: user.mustChangePassword,
        phone: user.phone,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Session logout endpoint
 */
router.post('/logout', authenticate, (req, res) => {
  return sendSuccess(res, {
    message: 'Logged out successfully',
    data: null,
  });
});

/**
 * POST /api/v1/auth/forgot-password
 * Initiates password reset by issuing a 30-min token
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw AppError.badRequest('Email is required');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      const resetToken = crypto.randomUUID();
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await user.save({ validateBeforeSave: false });

      // In production, send email with resetToken link
    }

    // Always return 200 for user privacy
    return sendSuccess(res, {
      message: 'If this email is registered, a password reset link has been sent.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/reset-password
 * Verifies reset token and sets new password
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      throw AppError.badRequest('Reset token and new password are required');
    }

    if (newPassword.length < 6) {
      throw AppError.badRequest('Password must be at least 6 characters long');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw AppError.badRequest('Password reset token is invalid or has expired');
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.mustChangePassword = false;
    await user.save();

    return sendSuccess(res, {
      message: 'Password has been reset successfully. Please log in with your new password.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/change-password
 * Authenticated password change (clears mustChangePassword)
 */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw AppError.badRequest('Current password and new password are required');
    }

    if (newPassword.length < 6) {
      throw AppError.badRequest('New password must be at least 6 characters long');
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw AppError.badRequest('Current password is incorrect');
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    return sendSuccess(res, {
      message: 'Password updated successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
