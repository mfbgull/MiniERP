/**
 * Global error handling middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
