import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { streamNotifications, getNotifications, markAllRead, markRead } from '../controllers/notifications.controller';

const router = Router();
router.use(authenticate);

router.get('/stream', streamNotifications);
router.get('/', getNotifications);
router.post('/read-all', markAllRead);
router.post('/:id/read', markRead);

export default router;
