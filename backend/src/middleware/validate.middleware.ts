import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = (result.error as ZodError).issues.map((e) => ({
      field: e.path.map(String).join('.'),
      message: e.message,
    }));
    res.status(400).json({ error: 'Validation failed', details: errors });
    return;
  }
  req.body = result.data;
  next();
};
