const express = require('express');
const router = express.Router();
const {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getAllServicesPublic
} = require('../controllers/service.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

// Route publique pour l'inscription (retourne tous les services)
router.get('/public', getAllServicesPublic);

// Les routes GET nécessitent l'authentification pour filtrer par service
router.get('/', authMiddleware, getAllServices);
router.get('/:id', authMiddleware, getServiceById);
router.post('/', authMiddleware, adminMiddleware, createService);
router.put('/:id', authMiddleware, adminMiddleware, updateService);
router.delete('/:id', authMiddleware, adminMiddleware, deleteService);

module.exports = router;

