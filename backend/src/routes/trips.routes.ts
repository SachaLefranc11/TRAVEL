import { Router } from 'express';
import { getTrips, getTrip, createTrip, updateTrip, deleteTrip } from '../controllers/trips.controller';
import { getExpenses, createExpense, updateExpense, deleteExpense, getBalances } from '../controllers/expenses.controller';
import { getLocations, createLocation, deleteLocation } from '../controllers/locations.controller';
import { inviteParticipant, removeParticipant } from '../controllers/participants.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { CreateTripDTO, UpdateTripDTO, CreateLocationDTO } from '../dtos/trip.dto';
import { CreateExpenseDTO, UpdateExpenseDTO } from '../dtos/expense.dto';
import { InviteParticipantDTO } from '../dtos/participant.dto';

const router = Router();
router.use(authenticate);

router.get('/', getTrips);
router.post('/', validate(CreateTripDTO), createTrip);
router.get('/:id', getTrip);
router.put('/:id', validate(UpdateTripDTO), updateTrip);
router.delete('/:id', deleteTrip);

router.get('/:tripId/expenses', getExpenses);
router.post('/:tripId/expenses', validate(CreateExpenseDTO), createExpense);
router.put('/:tripId/expenses/:eid', validate(UpdateExpenseDTO), updateExpense);
router.delete('/:tripId/expenses/:eid', deleteExpense);
router.get('/:tripId/balances', getBalances);

router.post('/:tripId/participants', validate(InviteParticipantDTO), inviteParticipant);
router.delete('/:tripId/participants/:userId', removeParticipant);

router.get('/:tripId/locations', getLocations);
router.post('/:tripId/locations', validate(CreateLocationDTO), createLocation);
router.delete('/:tripId/locations/:lid', deleteLocation);

export default router;
