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

const logFile = path.join(__dirname, 'logs', 'auth.log');
fs.mkdirSync(path.dirname(logFile), { recursive: true });

// Middleware
app.use(express.urlencoded({ extended: true }));

// Session configuration (HTTP-only cookie)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,
        secure: true,
        maxAge: 3600000
    }
}));

// Authentication Middleware
const requireLogin = (req, res, next) => {
    if (req.session && req.session.isLoggedIn) {
        return next();
    } else {
        return res.redirect('/');
    }
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Protect all other static files (e.g., /dashboard.html) — now runs BEFORE static
app.get('/*splat', requireLogin, (req, res, next) => {
    next();
});

// Static file serving now only reached after passing requireLogin
app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

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