import { Router } from 'express';
import { register, login, getMe, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { RegisterDTO, LoginDTO, ForgotPasswordDTO, ResetPasswordDTO } from '../dtos/auth.dto';

const router = Router();

router.post('/register', validate(RegisterDTO), register);
router.post('/login', validate(LoginDTO), login);
router.post('/forgot-password', validate(ForgotPasswordDTO), forgotPassword);
router.post('/reset-password', validate(ResetPasswordDTO), resetPassword);
router.get('/me', authenticate, getMe);

export default router;
