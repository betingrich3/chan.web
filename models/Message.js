const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    group: {
        type: Schema.Types.ObjectId,
        ref: 'Group'
    },
    content: {
        type: String,
        required: function() {
            return !this.media;
        }
    },
    media: {
        url: String,
        type: {
            type: String,
            enum: ['image', 'video', 'document', 'audio']
        },
        caption: String
    },
    isEncrypted: {
        type: Boolean,
        default: false
    },
    encryptionKey: String,
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedFor: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    reactions: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        emoji: String
    }],
    repliedTo: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
    }
}, {
    timestamps: true
});

// Indexes for faster querying
messageSchema.index({ sender: 1 });
messageSchema.index({ receiver: 1 });
messageSchema.index({ group: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
