// Locations routes — POST is api-key-protected, GET history is open
// (the dashboard is internal and read-only).
import { Router } from 'express';
import { recordLocation, getHistory } from '../controllers/locationController.mjs';
import { requireApiKey } from '../middleware/apiKey.mjs';

const router = Router();

router.post('/', requireApiKey, recordLocation);
router.get('/:deviceId/history', getHistory);

export default router;
