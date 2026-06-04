import { Router } from 'express';
import { getDestinationImage, geocode, getActivities, uploadTripImage } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/destination-image', getDestinationImage);
router.get('/geocode', geocode);
router.get('/activities', getActivities);
router.post('/trips/:id/image', uploadTripImage);

export default router;
