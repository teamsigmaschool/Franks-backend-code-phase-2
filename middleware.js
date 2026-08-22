const supabase = require('./supabaseClient');
const pool = require('./db');
const { ApiError } = require('./envelope');

async function verifySession(req, res, next) 
{
    try 
    {
        const header = req.headers.authorization;
        if (!header) return next(new ApiError(401, 'Unauthorized', 'Missing Authorization header'));
        
        const token = header.split(' ')[1]; // Take after "bearer"

        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) 
        {
            return next(new ApiError(401, 'Unauthorized', 'Invalid or expired session'));
        }

        const { rows } = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [data.user.id]);
        if (rows.length === 0)
        {
            return next(new ApiError(500, 'Internal Server Error', 'User profile not found for this account.'));
        }

        // Load user
        req.user = { id: rows[0].id, username: rows[0].username, role: rows[0].role, email: data.user.email };
        next();
        
    } catch (err) 
      {
        next(err);
      }
}

function requireRole(allowed) 
{
    return function (req, res, next) 
    {
        if (!req.user) return next(new ApiError(401, 'Unauthorized', 'Not authenticated'));

        if (!allowed.includes(req.user.role)) 
        {
            return next(new ApiError(403, 'Forbidden', `Requires the '${allowed}' role`));
        }
        next();
    };
}

module.exports = { verifySession, requireRole };
