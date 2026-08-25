function sanitizeText(input) {
  if (typeof input !== 'string') return input;
  return input
    .trim()                    // drop leading/trailing whitespace
    .replace(/\s+/g, ' ')      // collapse repeated whitespace into one space
    .replace(/<[^>]*>/g, '');  // strip anything that looks like an HTML tag
}

const ALLOWED_ROLES = ['viewer', 'eventer'];
const ALLOWED_SORT = ['event_date', 'created_at', 'title'];
const ALLOWED_ORDER = ['asc', 'desc'];

function isUuid(value) {
  return typeof value === 'string';
}

function validateSignup(body) {
  const errors = [];
  const email = sanitizeText(body.email);
  const password = body.password;

  // Email validation already handled by Supabase

  if (typeof password !== 'string' || password.length < 8) {
    errors.push('password must be at least 8 characters');

  } else if (!/[0-9]/.test(password)) {
    errors.push('password must contain at least one number');

  } else if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('password must contain at least one special character');
  }
  return { errors, clean: { email, password } };
}
function validateLogin(body) {
  const errors = [];
  const email = sanitizeText(body.email);
  const password = body.password;
  if (!email || !password) {
    errors.push('email and password are required');
  }
  return { errors, clean: { email, password } };
}
function validateRoleChange(body) {
  const errors = [];
  const role = sanitizeText(body.role);
  if (!ALLOWED_ROLES.includes(role)) {
    errors.push(`role must be one of: ${ALLOWED_ROLES.join(', ')}`);
  }
  return { errors, clean: { role } };
}
function validateEventInput(body, options) {
  const partial = (options && options.partial) || false;
  const errors = [];
  const clean = {};

  if (!partial || body.title !== undefined) {
    const title = sanitizeText(body.title);
    if (!title) errors.push('title is required');
    else clean.title = title;
  }
  
  if (body.description !== undefined) clean.description = sanitizeText(body.description) || null;

  if (!partial || body.event_date !== undefined) {
    const date = sanitizeText(body.event_date);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push('event_date must be YYYY-MM-DD');
    } else {
      clean.event_date = date;
    }
  }
  
  if (body.location !== undefined) clean.location = sanitizeText(body.location) || null;
  
  if (body.category !== undefined) clean.category = sanitizeText(body.category) || null;

  return { errors, clean };
}
function validatePagination(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = 10;
  if (limit > 50) limit = 50;
  return { page, limit, offset: (page - 1) * limit };
}
function validateSort(query) {
  const sortBy = ALLOWED_SORT.includes(query.sortBy) ? query.sortBy : 'event_date';
  const order = ALLOWED_ORDER.includes((query.order || '').toLowerCase())
    ? query.order.toLowerCase()
    : 'asc';
  return { sortBy, order };
}

// This is for input validation and data sanitization
module.exports = {
  sanitizeText,
  validateSignup,
  validateLogin,
  validateRoleChange,
  validateEventInput,
  validatePagination,
  validateSort,
  ALLOWED_ROLES,

  isUuid,
};


