const User = require('../models/User');

// Authentication middleware
exports.authenticate = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Check if user is already logged in
exports.redirectIfAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/chat');
    }
    next();
};

// Admin middleware
exports.isAdmin = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group.admins.includes(req.session.user._id)) {
            return res.status(403).json({ error: 'Unauthorized: Admin access required' });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Group member middleware
exports.isGroupMember = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group.members.includes(req.session.user._id)) {
            return res.status(403).json({ error: 'Unauthorized: Not a group member' });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Check message ownership
exports.isMessageOwner = async (req, res, next) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (message.sender.toString() !== req.session.user._id) {
            return res.status(403).json({ error: 'Unauthorized: Not message owner' });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
