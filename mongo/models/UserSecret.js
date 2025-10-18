const mongoose = require('mongoose')
const crypto = require('crypto')

const userSecretSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true, 
  },
  secretKey: {
    type: String,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => Date.now() + 5 * 60 * 1000
  }
},
{
    timestamps:true
}
)

userSecretSchema.pre('save', function (next) {
    if (!this.secretKey) {
        const randomToken = crypto.randomBytes(16).toString('hex');
        this.secretKey = randomToken;
    }
    if (!this.expiresAt) {
      this.expiresAt = Date.now() + 5 * 60 * 1000;
    }
    next()
})

module.exports = mongoose.model('UserSecret', userSecretSchema)