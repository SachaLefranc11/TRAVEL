import { Router } from 'express';
import { getTrips, getTrip, createTrip, updateTrip, deleteTrip } from '../controllers/trips.controller';
import { getExpenses, createExpense, updateExpense, deleteExpense, getBalances } from '../controllers/expenses.controller';
import { getLocations, createLocation, deleteLocation } from '../controllers/locations.controller';
import { inviteParticipant, removeParticipant } from '../controllers/participants.controller';
import { getPlanner, createPlannerActivity, updatePlannerActivity, deletePlannerActivity, getPlannerLogs } from '../controllers/planner.controller';
import { getSettlements, createSettlement, deleteSettlement } from '../controllers/settlements.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { CreateTripDTO, UpdateTripDTO, CreateLocationDTO } from '../dtos/trip.dto';
import { CreateExpenseDTO, UpdateExpenseDTO } from '../dtos/expense.dto';
import { InviteParticipantDTO } from '../dtos/participant.dto';
import { CreatePlannerActivityDTO, UpdatePlannerActivityDTO } from '../dtos/planner.dto';
import { CreateSettlementDTO } from '../dtos/settlement.dto';

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

router.get('/:tripId/settlements', getSettlements);
router.post('/:tripId/settlements', validate(CreateSettlementDTO), createSettlement);
router.delete('/:tripId/settlements/:sid', deleteSettlement);

router.post('/:tripId/participants', validate(InviteParticipantDTO), inviteParticipant);
router.delete('/:tripId/participants/:userId', removeParticipant);

router.get('/:tripId/planner', getPlanner);
router.get('/:tripId/planner/logs', getPlannerLogs);
router.post('/:tripId/planner', validate(CreatePlannerActivityDTO), createPlannerActivity);
router.put('/:tripId/planner/:aid', validate(UpdatePlannerActivityDTO), updatePlannerActivity);
router.delete('/:tripId/planner/:aid', deletePlannerActivity);

router.get('/:tripId/locations', getLocations);
router.post('/:tripId/locations', validate(CreateLocationDTO), createLocation);
router.delete('/:tripId/locations/:lid', deleteLocation);

export default router;
