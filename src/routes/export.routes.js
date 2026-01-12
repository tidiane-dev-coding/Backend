const express = require('express');
const router = express.Router();
const {
  exportEmployeesPDF,
  exportEmployeesExcel,
  exportAttendancePDF,
  exportAttendanceExcel,
  exportServiceEmployeesPDF,
  exportEmployeePDF
} = require('../controllers/export.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.get('/employees/pdf', authMiddleware, exportEmployeesPDF);
router.get('/employees/excel', authMiddleware, exportEmployeesExcel);
router.get('/employees/:employeeId/pdf', authMiddleware, exportEmployeePDF);
router.get('/services/:serviceId/employees/pdf', authMiddleware, exportServiceEmployeesPDF);
router.get('/attendance/pdf', authMiddleware, exportAttendancePDF);
router.get('/attendance/excel', authMiddleware, exportAttendanceExcel);

module.exports = router;

