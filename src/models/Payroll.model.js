const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  periodMonth: {
    type: Number,
    min: 1,
    max: 12,
    required: true
  },
  periodYear: {
    type: Number,
    required: true
  },
  baseSalary: {
    type: Number,
    required: true,
    min: 0
  },
  allowances: {
    type: Number,
    default: 0,
    min: 0
  },
  deductions: {
    type: Number,
    default: 0,
    min: 0
  },
  netSalary: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'GNF',
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'validated', 'paid'],
    default: 'draft'
  },
  note: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Calcul automatique du salaire net avant sauvegarde
payrollSchema.pre('save', function (next) {
  const base = this.baseSalary || 0;
  const allowances = this.allowances || 0;
  const deductions = this.deductions || 0;
  this.netSalary = Math.max(0, base + allowances - deductions);
  next();
});

// Empêcher les doublons de bulletin pour un employé sur une même période
payrollSchema.index({ employee: 1, periodMonth: 1, periodYear: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);

