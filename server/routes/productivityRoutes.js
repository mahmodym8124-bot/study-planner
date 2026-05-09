import { Router } from 'express';
import { getProductivity, saveProductivity } from '../controllers/productivityController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/', getProductivity);
router.put('/', saveProductivity);
export default router;
