require('dotenv').config();

const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const { updateCouncilInfo } = require('./scripts/update-council-info');

const app = express();
const PORT = 3000;

app.set('trust proxy', 1);

const logFile = path.join(__dirname, 'logs', 'auth.log');
fs.mkdirSync(path.dirname(logFile), { recursive: true });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ensure data directory exists
const dataDir = path.join(__dirname, 'public', 'data');
fs.mkdirSync(dataDir, { recursive: true });

// Session configuration (HTTP-only cookie)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
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

// Role-based authorization middleware.
// `allowedRoles` is a list of roles permitted to access the route.
// Must be composed AFTER requireLogin so req.session.role is populated.
const requireRole = (...allowedRoles) => (req, res, next) => {
    if (req.session && allowedRoles.includes(req.session.role)) {
        return next();
    }
    return res.status(403).json({ success: false, error: 'Forbidden: insufficient role' });
};

// Routes
app.get('/', (req, res) => {
    if (req.session && req.session.isLoggedIn) {
        return res.redirect('/dashboard.html');
    }
    // Not logged in — serve the login page as usual
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Static file serving - serve CSS, JS, images without authentication
app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

// Log static file requests for debugging
app.use((req, res, next) => {
    if (req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
        console.log(`Static file request: ${req.method} ${req.path} - IP: ${req.ip}`);
    }
    next();
});

// Prevent caching of dynamic/authenticated content (HTML pages, API responses, redirects)
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path.startsWith('/api/') || req.path === '/') {
        res.set('Cache-Control', 'no-store');
    }
    next();
});

// Protect HTML pages (e.g., /dashboard.html) - but not static assets
app.use((req, res, next) => {
    // Only require login for HTML files (except index.html which is the login page)
    if (req.path.endsWith('.html') && req.path !== '/index.html') {
        return requireLogin(req, res, next);
    }
    next();
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
    
    // Get client IP (Accounting for Nginx Proxy Manager)
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Check all users defined as USERNAME_1, PASSWORD_HASH_1, USERNAME_2, PASSWORD_HASH_2, etc.
    let matched = false;
    for (let i = 1; process.env[`USERNAME_${i}`]; i++) {
        const validUsername = process.env[`USERNAME_${i}`];
        const validPasswordHash = process.env[`PASSWORD_HASH_${i}`];
        
        if (!validPasswordHash) {
            console.error(`Missing PASSWORD_HASH_${i} for user ${validUsername}`);
            continue;
        }

        if (username === validUsername && await bcrypt.compare(password, validPasswordHash)) {
            matched = true;
            break;
        }
    }

    if (matched) {
        req.session.isLoggedIn = true;
        req.session.username = username; // Track which user logged in
        req.session.role = 'editor';
        res.redirect('/dashboard.html');
    } else if (process.env.KIDUSER && process.env.KIDPASS_HASH &&
               username === process.env.KIDUSER &&
               await bcrypt.compare(password, process.env.KIDPASS_HASH)) {
        // Kid user — can toggle checkboxes but cannot edit contenteditable text
        req.session.isLoggedIn = true;
        req.session.username = process.env.KIDUSER;
        req.session.role = 'kid';
        res.redirect('/dashboard.html');
    } else {
        // Log failure in a format Fail2Ban can read
        const logEntry = `${new Date().toISOString()} Failed login attempt from IP: ${clientIp} for user: ${username}\n`;
        fs.appendFileSync(logFile, logEntry);
        
        res.redirect('/?error=1'); // Redirect back to login
    }
});

// API Routes - All protected by requireLogin middleware

// GET /api/me - Return the authenticated user's identity and role.
// The frontend uses this to decide whether to enable contenteditable fields.
app.get('/api/me', requireLogin, (req, res) => {
    res.json({ username: req.session.username, role: req.session.role });
});

// GET /api/checkbox-states - Read checkbox states
app.get('/api/checkbox-states', requireLogin, (req, res) => {
    const filePath = path.join(dataDir, 'checkbox-states.json');
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({});
        }
    } catch (error) {
        console.error('Error reading checkbox-states.json:', error);
        res.json({});
    }
});

// POST /api/checkbox-states - Save checkbox states
app.post('/api/checkbox-states', requireLogin, (req, res) => {
    const filePath = path.join(dataDir, 'checkbox-states.json');
    try {
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
        res.json({ success: true });
    } catch (error) {
        console.error('Error writing checkbox-states.json:', error);
        res.status(500).json({ success: false, error: 'Failed to save checkbox states' });
    }
});

// GET /api/text-states - Read text states
app.get('/api/text-states', requireLogin, (req, res) => {
    const filePath = path.join(dataDir, 'text-states.json');
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({});
        }
    } catch (error) {
        console.error('Error reading text-states.json:', error);
        res.json({});
    }
});

// POST /api/text-states - Save text states (editors only; kid role is read-only)
app.post('/api/text-states', requireLogin, requireRole('editor'), (req, res) => {
    const filePath = path.join(dataDir, 'text-states.json');
    try {
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
        res.json({ success: true });
    } catch (error) {
        console.error('Error writing text-states.json:', error);
        res.status(500).json({ success: false, error: 'Failed to save text states' });
    }
});

// Update council information in main-rules.html before server starts
(async () => {
    try {
        await updateCouncilInfo();
    } catch (error) {
        console.error('Failed to update council information:', error);
        process.exit(1);
    }
})();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});