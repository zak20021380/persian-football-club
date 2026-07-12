import type { NextFunction, Request, Response } from 'express';

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => (req: Request, res: Response, next: NextFunction): void => {
  void Promise.resolve(fn(req, res, next)).catch(next);
};
