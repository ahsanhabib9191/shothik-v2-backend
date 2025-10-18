const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true, 
    },
    google: {
        email: {
            type: String,
        },
        accessToken: {
            type: String,
        },
        refreshToken: {
            type: String,
        },
        tokenExpiryDate: {
            type: Date,
        },
    },
    microsoft: {
        email: {
            type: String,
        },
        accessToken: {
            type: String,
        },
        fefreshToken: {
            type: String,
        },
        tokenExpiryDate: {
            type: Date,
        },
    },
}, {
    timestamps: true,
});

const PermissionModel = mongoose.model('Permission', permissionSchema);

module.exports = { PermissionModel };
