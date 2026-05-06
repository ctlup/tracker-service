// Devices routes — pure HTTP wiring, no business logic.
import { Router } from 'express';
import { registerDevice, listDevices } from '../controllers/deviceController.mjs';

const router = Router();

router.post('/register', registerDevice);
router.get('/', listDevices);

export default router;
