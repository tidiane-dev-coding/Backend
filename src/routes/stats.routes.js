const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/stats.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.get('/dashboard', authMiddleware, getDashboardStats);

module.exports = router;

