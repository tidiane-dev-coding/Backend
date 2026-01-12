const express = require('express');
const router = express.Router();
const {
  getAllLeaves,
  getLeaveById,
  createLeave,
  updateLeave,
  deleteLeave,
  approveLeave,
  rejectLeave
} = require('../controllers/leave.controller');
const { authMiddleware, adminOrServiceAdminMiddleware } = require('../middleware/auth.middleware');

router.get('/', authMiddleware, getAllLeaves);
router.get('/:id', authMiddleware, getLeaveById);
router.post('/', authMiddleware, createLeave);
router.put('/:id', authMiddleware, updateLeave);
router.delete('/:id', authMiddleware, deleteLeave);
router.post('/:id/approve', authMiddleware, adminOrServiceAdminMiddleware, approveLeave);
router.post('/:id/reject', authMiddleware, adminOrServiceAdminMiddleware, rejectLeave);

module.exports = router;

