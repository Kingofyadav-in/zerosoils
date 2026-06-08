const HANDLERS = {
  'verify': require('./hdi/_verify'),
}

module.exports = async (req, res) => {
  const action = (req.url || '').replace(/^\/api\/hdi\/?/, '').split('?')[0]
  const handler = HANDLERS[action]
  if (handler) return handler(req, res)
  return res.status(404).json({ error: `Unknown hdi route: ${action}` })
}
