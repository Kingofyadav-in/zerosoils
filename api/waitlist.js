const HANDLERS = {
  'count': require('./waitlist/_count'),
  'join':  require('./waitlist/_join'),
}

module.exports = async (req, res) => {
  const action = (req.url || '').replace(/^\/api\/waitlist\/?/, '').split('?')[0]
  const handler = HANDLERS[action]
  if (handler) return handler(req, res)
  return res.status(404).json({ error: `Unknown waitlist route: ${action}` })
}
