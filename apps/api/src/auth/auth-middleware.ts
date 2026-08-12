import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../http/api-error.js';
import type { TokenService } from './token-service.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(tokenService: TokenService) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    const header = request.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      next(new ApiError(401, 'AUTH_REQUIRED', '请先完成匿名身份认证'));
      return;
    }
    try {
      request.userId = (await tokenService.verify(token)).userId;
      next();
    } catch {
      next(new ApiError(401, 'AUTH_INVALID', '匿名身份已失效，请重新认证'));
    }
  };
}
