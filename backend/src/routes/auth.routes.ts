import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { RegisterDTO, LoginDTO } from '../dtos/auth.dto';

const router = Router();

router.post('/register', validate(RegisterDTO), register);
router.post('/login', validate(LoginDTO), login);
router.get('/me', authenticate, getMe);

export default router;
