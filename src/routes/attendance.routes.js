const express = require('express');
const router = express.Router();
const {
  getAllAttendance,
  getAttendanceById,
  checkIn,
  checkOut,
  markAbsence,
  updateAttendance,
  deleteAttendance
} = require('../controllers/attendance.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

router.get('/', authMiddleware, getAllAttendance);
router.get('/:id', authMiddleware, getAttendanceById);
router.post('/checkin', authMiddleware, checkIn);
router.post('/checkout', authMiddleware, checkOut);
router.post('/absence', authMiddleware, adminMiddleware, markAbsence);
router.put('/:id', authMiddleware, adminMiddleware, updateAttendance);
router.delete('/:id', authMiddleware, adminMiddleware, deleteAttendance);

module.exports = router;

