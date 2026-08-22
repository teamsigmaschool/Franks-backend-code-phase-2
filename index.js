require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const { verifySession, requireRole } = require('./middleware');
const { ApiError, errorHandler } = require('./envelope');
// Your own handlers
const h = require('./handlers');

const app = express();


// ---- Secure API Practices ----
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: process.env.BODY_SIZE_LIMIT || '10kb' }));

const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 250,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { status: 429, title: 'Too Many Requests', detail: 'Slow down and try again shortly.' },
  },
});

const loginLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { status: 429, title: 'Too Many Requests', detail: 'Too many login attempts. Try again shortly.' },
  },
});

app.use(generalLimiter);


// ---- API versioning ----
const v1 = express.Router();
app.use('/festivent/v1', v1)

// ---- Auth route ----
v1.post('/auth/signup', h.signup);
v1.post('/auth/login', loginLimiter, h.login);
v1.get('/auth/whoami', verifySession, h.whoami);
// ---- Change roles ----
v1.patch('/users/me/role', verifySession, h.changeRole);
// ---- Get all events ----
v1.get('/events', h.getEvents);
// ---- Create an event, only eventer ----
v1.post('/events', verifySession, requireRole('eventer'), h.createEvent);
// ---- Update and Delete event, only eventer + owned ----
v1.patch('/events/:id', verifySession, requireRole('eventer'), h.updateEvent);
v1.delete('/events/:id', verifySession, requireRole('eventer'), h.deleteEvent);



// ---- V2 Deployement ----
const v2 = express.Router();
app.use('/festivent/v2', v2)

v2.post('/auth/signup', h.signup);
v2.post('/auth/login', loginLimiter, h.login);
v2.get('/auth/whoami', verifySession, h.whoami);
v2.patch('/users/me/role', verifySession, h.changeRole);
v2.get('/events', h.getEventsV2);
v2.post('/events', verifySession, requireRole('eventer'), h.createEvent);
v2.patch('/events/:id', verifySession, requireRole('eventer'), h.updateEvent);
v2.delete('/events/:id', verifySession, requireRole('eventer'), h.deleteEvent);

// ---- The new routes ----
v2.post('/events/:id/join', verifySession, requireRole('viewer'), h.joinEvent);
v2.delete('/events/:id/join', verifySession, requireRole('viewer'), h.leaveEvent);
v2.get('/events/joined', verifySession, requireRole('viewer'), h.getJoinedEvents);
v2.get('/events/stats/by-organizer', h.getStatsByOrganizer);



// Error wrapping
app.use((req, res, next) => {
  next(new ApiError(404, 'Not Found', 'Route not found'));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Festivent Phase 1 backend listening on :${PORT}`));
}

module.exports = app;

