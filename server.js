require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const expressLayouts = require('express-ejs-layouts');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const debug = require('debug')('app:server');
const http = require('http');
const socketio = require('socket.io');

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Trust Heroku proxy for secure cookies
app.set('trust proxy', 1);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
}).then(() => debug('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

mongoose.set('debug', true);

// Models
const User = require('./models/User');
const Message = require('./models/Message');

// Socket.IO active connections
const activeSockets = {};

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// View Engine
app.use(expressLayouts);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/layout');

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// File Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|mp4|pdf/;
    const valid = filetypes.test(file.mimetype) && filetypes.test(path.extname(file.originalname).toLowerCase());
    cb(valid ? null : new Error('Invalid file type'), valid);
  }
});

// Auth Middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
};

// Socket.IO Logic
io.on('connection', (socket) => {
  socket.on('join', async (username) => {
    if (!username) return;
    
    activeSockets[socket.id] = username;
    
    // Update user status in database
    await User.findOneAndUpdate(
      { username },
      { isOnline: true, lastSeen: new Date() }
    );

    io.emit('message', {
      username: 'System',
      text: `${username} is online`,
      timestamp: new Date(),
      type: 'system'
    });

    // Send message history to new user
    const messages = await Message.find().sort({ createdAt: 1 }).limit(100);
    socket.emit('messageHistory', messages);
  });

  socket.on('chatMessage', async (msg) => {
    const username = activeSockets[socket.id] || 'Anonymous';
    
    // Save message to database
    const message = new Message({
      username,
      text: msg.text,
      type: 'chat'
    });
    
    await message.save();
    
    // Broadcast to all clients
    io.emit('message', {
      username,
      text: msg.text,
      timestamp: new Date(),
      type: 'chat'
    });
  });

  socket.on('disconnect', async () => {
    const username = activeSockets[socket.id];
    if (username) {
      delete activeSockets[socket.id];
      
      // Update user status in database
      await User.findOneAndUpdate(
        { username },
        { isOnline: false, lastSeen: new Date() }
      );

      io.emit('message', {
        username: 'System',
        text: `${username} left the chat`,
        timestamp: new Date(),
        type: 'system'
      });
    }
  });
});

// Routes
app.get('/', (req, res) => res.redirect('/chat'));

// Chat route
app.get('/chat', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: 1 }).limit(100);
    const onlineUsers = await User.find({ isOnline: true });

    res.render('chat', {
      title: 'BBWhatsApp',
      user: req.session.user,
      messages,
      onlineUsers,
      darkMode: req.session.darkMode || false,
      currentUser: req.session.user,
      header: true
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).render('error', {
      title: 'Chat Error',
      user: req.session.user,
      error: 'Failed to load chat',
      header: true
    });
  }
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/chat');
  res.render('login', {
    title: 'Login',
    error: null,
    email: req.query.email || '',
    header: false
  });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.render('login', {
        title: 'Login',
        error: 'Email and password are required',
        email: email || '',
        header: false
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid email or password',
        email,
        header: false
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid email or password',
        email,
        header: false
      });
    }

    await User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastSeen: new Date()
    });

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic
    };

    const redirectTo = req.session.returnTo || '/chat';
    delete req.session.returnTo;
    res.redirect(redirectTo);

  } catch (err) {
    console.error('Login error:', err);
    res.render('login', {
      title: 'Login',
      error: 'Login failed. Please try again.',
      email: req.body.email || '',
      header: false
    });
  }
});

app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/chat');
  res.render('register', {
    title: 'Register',
    error: null,
    formData: {},
    header: false
  });
});

app.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      return res.render('register', {
        title: 'Register',
        error: 'Passwords do not match',
        formData: { username, email },
        header: false
      });
    }
    
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.render('register', {
        title: 'Register',
        error: 'Email already exists. Please login instead.',
        formData: { username, email },
        header: false
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({
      username,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      isOnline: true,
      lastSeen: new Date()
    });

    await newUser.save();

    req.session.user = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      profilePic: newUser.profilePic
    };

    res.redirect('/chat');
  } catch (err) {
    console.error('Registration error:', err);
    res.render('register', {
      title: 'Register',
      error: 'Registration failed. Please try again.',
      formData: req.body,
      header: false
    });
  }
});

app.get('/logout', async (req, res) => {
  if (req.session.user) {
    await User.findByIdAndUpdate(req.session.user.id, {
      isOnline: false,
      lastSeen: new Date()
    });
  }
  
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Server Error');
    }
    res.redirect('/login');
  });
});

// Error handlers
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    user: req.session.user || null,
    header: true
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    title: 'Server Error',
    user: req.session.user || null,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
    header: true
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
