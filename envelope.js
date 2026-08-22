function sendSuccess(res, data, meta = {}, status = 200) {
  return res.status(status).json({ success: true, data, meta });
}

class ApiError extends Error {
  constructor(status, title, detail) {
    super(detail || title);
    this.status = status;
    this.title = title;
    this.detail = detail;
  }
}

function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { status: err.status, title: err.title, detail: err.detail },
    });
  }

  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      error: { status: 413, title: 'Payload Too Large', detail: 'Request body exceeds the size limit.' },
    });
  }

  console.error('[unhandled error]', err);
  res.status(500).json({
    success: false,
    error: { status: 500, title: 'Internal Server Error', detail: 'Something went wrong.' },
  });
}

// This is for your success and error wrappers
module.exports = { sendSuccess, ApiError, errorHandler };

