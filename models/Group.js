const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groupSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    description: {
        type: String,
        maxlength: 200
    },
    creator: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    admins: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    members: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    avatar: {
        type: String,
        default: '/images/default-group.png'
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
    }
}, {
    timestamps: true
});

// Add admin to members array if not already present
groupSchema.pre('save', function(next) {
    if (this.isNew && !this.members.includes(this.creator)) {
        this.members.push(this.creator);
    }
    if (this.isNew && !this.admins.includes(this.creator)) {
        this.admins.push(this.creator);
    }
    next();
});

module.exports = mongoose.model('Group', groupSchema);
