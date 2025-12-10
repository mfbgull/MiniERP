const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const productionController = require('../controllers/productionController');

router.use(authenticateToken);

router.post('/productions', productionController.recordProduction);
router.get('/productions', productionController.getProductions);
router.get('/productions/:id', productionController.getProduction);
router.delete('/productions/:id', productionController.deleteProduction);
router.get('/productions/summary/item/:item_id', productionController.getProductionSummaryByItem);

module.exports = router;
