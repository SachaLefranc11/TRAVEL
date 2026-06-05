import { z } from 'zod';

export const RegisterDTO = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const LoginDTO = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ForgotPasswordDTO = z.object({
  email: z.string().email(),
});

export const ResetPasswordDTO = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export type RegisterInput = z.infer<typeof RegisterDTO>;
export type LoginInput = z.infer<typeof LoginDTO>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordDTO>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordDTO>;
