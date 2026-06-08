const HANDLERS = {
  'stats': require('./admin/_stats'),
}

module.exports = async (req, res) => {
  const action = (req.url || '').replace(/^\/api\/admin\/?/, '').split('?')[0]
  const handler = HANDLERS[action]
  if (handler) return handler(req, res)
  return res.status(404).json({ error: `Unknown admin route: ${action}` })
}
