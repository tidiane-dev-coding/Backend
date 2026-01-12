const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  }
  ,
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);

// Virtual pour enfants (sous-services)
serviceSchema.virtual('children', {
  ref: 'Service',
  localField: '_id',
  foreignField: 'parent'
});

serviceSchema.set('toObject', { virtuals: true });
serviceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Service', serviceSchema);

