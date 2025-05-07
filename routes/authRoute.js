const express = require('express');
const router = express.Router();
const passport = require('passport');
const { ensureAuthenticated, forwardAuthenticated } = require('../middlewares/authMiddleware');

// Login Page
router.get('/login', forwardAuthenticated, (req, res) => {
  res.render('login', { 
    title: 'Login',
    header: false 
  });
});

// Login Handle
router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/chat',
    failureRedirect: '/login',
    failureFlash: true
  })(req, res, next);
});

// Register Page
router.get('/register', forwardAuthenticated, (req, res) => {
  res.render('register', { 
    title: 'Register',
    header: false 
  });
});

// Register Handle
router.post('/register', async (req, res) => {
  // Your registration logic
});

// Logout Handle
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

module.exports = router;
