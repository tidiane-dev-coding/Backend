const express = require('express');
const router = express.Router();
const {
  getAllEmployees,
  getEmployeeById,
  getEmployeeByMatricule,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getQRCode,
  getMyEmployee
} = require('../controllers/employee.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

router.get('/', authMiddleware, getAllEmployees);
router.get('/matricule/:matricule', authMiddleware, getEmployeeByMatricule);
router.get('/:id/qrcode', authMiddleware, getQRCode);
router.get('/me', authMiddleware, getMyEmployee);
router.get('/:id', authMiddleware, getEmployeeById);
// Autoriser la création pour tout utilisateur authentifié (le contrôleur appliquera les restrictions)
router.post('/', authMiddleware, createEmployee);
// Permettre à l'utilisateur authentifié de modifier son propre profil (le contrôleur contrôle l'accès)
router.put('/:id', authMiddleware, updateEmployee);
router.delete('/:id', authMiddleware, adminMiddleware, deleteEmployee);

module.exports = router;

