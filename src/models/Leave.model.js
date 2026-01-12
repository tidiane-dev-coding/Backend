const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  matricule: {
    type: String,
    required: true
  },
  nom: {
    type: String,
    required: true
  },
  dateDebut: {
    type: Date,
    required: true
  },
  dateFin: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['annuel', 'maladie', 'maternite', 'paternite', 'exceptionnel', 'sans_solde', 'autre'],
    required: true,
    default: 'annuel'
  },
  statut: {
    type: String,
    enum: ['en_attente', 'approuve', 'refuse'],
    default: 'en_attente'
  },
  raison: {
    type: String,
    required: true,
    trim: true
  },
  preuve: {
    type: String // data URL ou URL stockée
  },
  commentaireAdmin: {
    type: String,
    trim: true
  },
  approuvePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dateApprobation: {
    type: Date
  }
}, {
  timestamps: true
});

// Validation: dateFin doit être >= dateDebut
leaveSchema.pre('save', function(next) {
  if (this.dateFin < this.dateDebut) {
    return next(new Error('La date de fin doit être supérieure ou égale à la date de début'));
  }
  next();
});

module.exports = mongoose.model('Leave', leaveSchema);

