import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';
import { User } from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'lumos_crm_jwt_secret_dev_key_2026';

/**
 * Authentication Middleware
 * Validates JWT access token in the Authorization Bearer header.
 * Populates req.user with the active user record.
 */
export async function authenticate(req, res, next) {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(AppError.unauthorized('Authentication required or session has expired. Please log in again.'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(AppError.unauthorized('Authentication token has expired. Please log in again.'));
      }
      return next(AppError.unauthorized('Invalid authentication token.'));
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(AppError.unauthorized('User associated with this token no longer exists.'));
    }

    if (user.status === 'inactive') {
      return next(AppError.forbidden('Your account has been deactivated. Please contact the administrator.'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-Based Access Control (RBAC) Guard
 * @param  {...string} allowedRoles - 'admin', 'employee'
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('Access denied. You do not have permission to perform this action.'));
    }

    next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireEmployee = requireRole('employee');
