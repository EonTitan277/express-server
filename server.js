require('dotenv').config();

const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.set('trust proxy', 1);

// Setup logging for Fail2Ban
const logFile = path.join(__dirname, 'logs', 'auth.log');
fs.mkdirSync(path.dirname(logFile), { recursive: true });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
    index: false // We will handle routing manually to protect files
}));

// Session configuration (HTTP-only cookie)
app.use(session({
    secret: process.env.SESSION_SECRET,  // from .env
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,
        secure: true,
        maxAge: 3600000 // 1 hour
    }
}));

// Authentication Middleware
const requireLogin = (req, res, next) => {
    if (req.session && req.session.isLoggedIn) {
        return next();
    } else {
        // Redirect unauthenticated users to the login page
        return res.redirect('/');
    }
};

// Routes
app.get('/', (req, res) => {
    // Always serve index.html at the root
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Protect all other static files (e.g., /dashboard.html)
app.get('/*splat', requireLogin, (req, res, next) => {
    next(); // Let express.static handle the actual file serving
});

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 15 minutes
    max: 4, // Limit each IP to 4 login attempts per window
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Login Handler
app.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    const validUsername = process.env.USERNAME;
    const validPasswordHash = process.env.PASSWORD_HASH;
    
    if (!validUsername || !validPasswordHash) {
        console.error('Missing credentials in environment');
        return res.status(500).send('Server configuration error');
    }

    // Get client IP (Accounting for Nginx Proxy Manager)
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (username === validUsername && await bcrypt.compare(password, validPasswordHash)) {
        req.session.isLoggedIn = true;
        res.redirect('/dashboard.html');
    } else {
        // Log failure in a format Fail2Ban can read
        const logEntry = `${new Date().toISOString()} Failed login attempt from IP: ${clientIp} for user: ${username}\n`;
        fs.appendFileSync(logFile, logEntry);
        
        res.redirect('/?error=1'); // Redirect back to login
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});