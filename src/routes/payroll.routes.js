const express = require('express');
const router = express.Router();
const {
  getPayrolls,
  getPayrollById,
  createPayroll,
  updatePayroll,
  deletePayroll
} = require('../controllers/payroll.controller');
const { authMiddleware, adminOrServiceAdminMiddleware } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent d'être authentifié
router.use(authMiddleware);

// Liste / consultation des bulletins
router.get('/', getPayrolls);
router.get('/:id', getPayrollById);

// Gestion (création / modification / suppression) réservée aux admins et service_admin
router.post('/', adminOrServiceAdminMiddleware, createPayroll);
router.put('/:id', adminOrServiceAdminMiddleware, updatePayroll);
router.delete('/:id', adminOrServiceAdminMiddleware, deletePayroll);

module.exports = router;

