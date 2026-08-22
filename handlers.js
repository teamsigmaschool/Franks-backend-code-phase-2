// Fellow backend dev helped you with these
const supabase = require('./supabaseClient');
const pool = require('./db');
const { sendSuccess, ApiError } = require('./envelope');
const {
  validateSignup,
  validateLogin,
  validateRoleChange,
  validateEventInput,
  validatePagination,
  validateSort,
  isUuid,
} = require('./validation');

// Your turn now.
async function signup(req, res, next) 
{
  const { errors, clean } = validateSignup(req.body);
  if (errors.length) return next(new ApiError(400, 'Bad Request', errors.join('; ')));

  try 
  {
    const { data, error } = await supabase.auth.signUp
    ({
      email: clean.email,
      password: clean.password,
    });

    if (error)
    {
      if (error.message.includes('already registered')) 
      {
        return next(new ApiError(409, 'Conflict', 'Email already in use'));
      }
      return next(new ApiError(400, 'Bad Request', error.message));
    }
    
    return sendSuccess(res, { session: data.session, user: data.user }, {}, 201);

  } catch (err) 
    {
      next(err);
    }
}

async function login(req, res, next) 
{
  const { errors, clean } = validateLogin(req.body);
  if (errors.length) return next(new ApiError(400, 'Bad Request', errors.join('; ')));
  
  try 
  {
    const { data, error } = await supabase.auth.signInWithPassword({ email: clean.email, password: clean.password });
    
    if (error) return next(new ApiError(401, 'Unauthorized', 'Invalid email or password.'));
    
    return sendSuccess(res, { session: data.session, user: data.user });

  } catch (err) 
    {
      next(err);
    }
}

async function whoami(req, res) {
  return sendSuccess(res, { user: req.user });
}

async function changeRole(req, res, next) 
{
  const { errors, clean } = validateRoleChange(req.body);
  if (errors.length) return next(new ApiError(400, 'Bad Request', errors.join('; ')));

  try 
  {
    const { rows } = await pool.query
    (
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
      [clean.role, req.user.id]
    );

    return sendSuccess(res, { user: rows[0] });
  
  } catch (err)
    {
      next(err);
    }
}

async function getEvents(req, res, next) 
{
  try 
  {
    const { page, limit, offset } = validatePagination(req.query);
    const { sortBy, order } = validateSort(req.query);
    const params = [];
    const where = [];

    // Search by organizer
    if (req.query.organizer) 
    {
      params.push(`%${req.query.organizer}%`);
      where.push(`u.username ILIKE $${params.length}`);
    }
    
    // Filter by category
    if (req.query.category) 
    {
      params.push(req.query.category);
      where.push(`e.category ILIKE $${params.length}`);
    }
    
    // Filter date "from"
    if (req.query.from) 
    {
      params.push(req.query.from);
      where.push(`e.event_date >= $${params.length}`);
    }
    
    // Filter date "latest to"
    if (req.query.to) 
    {
      params.push(req.query.to);
      where.push(`e.event_date <= $${params.length}`);
    }

    // Search by event name or description
    if (req.query.search)
    {
      params.push(`%${req.query.search}%`);
      where.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
    }

    // Check if any filter applied, combine them if any
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // For the "n page out of n" thing
    const countResult = await pool.query
    (
      `SELECT COUNT(*)::int AS count FROM events e JOIN users u ON u.id = e.organizer_id ${whereSql}`,
      params
    );
    const total = countResult.rows[0].count;
    params.push(limit, offset);

    // Combine everything
    const { rows } = await pool.query
    (
      `SELECT e.id, e.title, e.description, e.event_date, e.location, e.category,
              u.username AS organizer
       FROM events e
       JOIN users u ON u.id = e.organizer_id
       ${whereSql}
       ORDER BY e.${sortBy} ${order}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return sendSuccess(res, rows, { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    next(err);
  }
}

async function getEventsV2(req, res, next)
{
  try 
  {
    const { page, limit, offset } = validatePagination(req.query);
    const { sortBy, order } = validateSort(req.query);
    const params = [];
    const where = [];

    if (req.query.organizer) 
    {
      params.push(`%${req.query.organizer}%`);
      where.push(`u.username ILIKE $${params.length}`);
    }
    // This one is new, for the clickable link
    if (req.query.organizer_id && isUuid(req.query.organizer_id)) {
      params.push(req.query.organizer_id);
      where.push(`u.id = $${params.length}`);
    }
    if (req.query.category) {
      params.push(req.query.category);
      where.push(`e.category = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`e.event_date >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`e.event_date <= $${params.length}`);
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM events e JOIN users u ON u.id = e.organizer_id ${whereSql}`,
      params
    );
    const total = countResult.rows[0].count;

    params.push(limit, offset);
    const { rows } = await pool.query
    (
      `SELECT e.id, e.title, e.description, e.event_date, e.location, e.category,
              u.id AS organizer_id, u.username AS organizer_username
       FROM events e
       JOIN users u ON u.id = e.organizer_id
       ${whereSql}
       ORDER BY e.${sortBy} ${order}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      event_date: r.event_date,
      location: r.location,
      category: r.category,
      organizer: { id: r.organizer_id, username: r.organizer_username },
    }));

    return sendSuccess(res, data, { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    next(err);
  }
}

async function createEvent(req, res, next) 
{
  const { errors, clean } = validateEventInput(req.body);
  if (errors.length) return next(new ApiError(400, 'Bad Request', errors.join('; ')));
  
  try 
  {
    const { rows } = await pool.query
    (
      `INSERT INTO events (title, description, event_date, location, category, organizer_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [clean.title, clean.description || null, clean.event_date, clean.location || null, 
        clean.category || null, req.user.id]
    );

    return sendSuccess(res, rows[0], {}, 201);

  } catch (err) 
    {
      next(err);
    }
}

async function updateEvent(req, res, next) 
{
  const { errors, clean } = validateEventInput(req.body, { partial: true });
  if (errors.length) return next(new ApiError(400, 'Bad Request', errors.join('; ')));

  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query
    (
      `UPDATE events SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         event_date = COALESCE($3, event_date),
         location = COALESCE($4, location),
         category = COALESCE($5, category)
       WHERE id = $6 AND organizer_id = $7
       RETURNING *`,
      [clean.title ?? null, clean.description ?? null, clean.event_date ?? null, 
        clean.location ?? null, clean.category ?? null, id, req.user.id]
    );

    if (rows.length === 0) 
    {
      return next(new ApiError(404, 'Not Found', 'Event not found, or not yours to edit'));
    }

    return sendSuccess(res, rows[0]);
  
  } catch (err) 
    {
      next(err);
    }
}

async function deleteEvent(req, res, next)
{
  try 
  {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query
    (
      'DELETE FROM events WHERE id = $1 AND organizer_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (rows.length === 0)
    {
      return next(new ApiError(404, 'Not Found', 'Event not found, or not yours to delete'));
    }

    return sendSuccess(res, { id });
  
  } catch (err) 
    {
      next(err);
    }
}

// ---- New features to make Bob happy ----

async function joinEvent(req, res, next) 
{
  const id = parseInt(req.params.id, 10);
  try 
  {
    await pool.query
    (
      'INSERT INTO event_joins (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, req.user.id]
    );
    return sendSuccess(res, { event_id: id }, {}, 201);
  
  } catch (err) 
    {
      if (err.code === '23503') return next(new ApiError(404, 'Not Found', 'Event not found.'));
      next(err);
    }
}

async function leaveEvent(req, res, next) 
{
  try 
  {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM event_joins WHERE event_id = $1 AND user_id = $2', [id, req.user.id]);
    
    return sendSuccess(res, { event_id: id });
  
  } catch (err)
    {
      next(err);
    }
}

async function getJoinedEvents(req, res, next)
{
  try
  {
    const { rows } = await pool.query
    (
      `SELECT e.id, e.title, e.description, e.event_date, e.location, e.category,
              u.id AS organizer_id, u.username AS organizer_username
       FROM events e
       JOIN event_joins ej ON ej.event_id = e.id
       JOIN users u ON u.id = e.organizer_id
       WHERE ej.user_id = $1
       ORDER BY e.event_date ASC`,
      [req.user.id]
    );

    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      event_date: r.event_date,
      location: r.location,
      category: r.category,
      organizer: { id: r.organizer_id, username: r.organizer_username },
    }));

    return sendSuccess(res, data);
  
  } catch (err) 
    {
      next(err);
    }
}

async function getStatsByOrganizer(req, res, next) 
{
  try 
  {
    const { rows } = await pool.query
    (
      `SELECT u.id AS organizer_id, u.username AS organizer,
              COUNT(DISTINCT e.id)::int AS event_count,
              COUNT(ej.user_id)::int AS total_joins
       FROM users u
       JOIN events e ON e.organizer_id = u.id
       LEFT JOIN event_joins ej ON ej.event_id = e.id
       GROUP BY u.id, u.username
       ORDER BY event_count DESC, organizer ASC`
    );
    
    return sendSuccess(res, rows);
  
  } catch (err) 
    {
      next(err);
    }
}



// You use this in index.js when setting the routes
module.exports = {
  signup,
  login,
  whoami,
  changeRole,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,

  getEventsV2,

  joinEvent,
  leaveEvent,
  getJoinedEvents,
  getStatsByOrganizer,
};
