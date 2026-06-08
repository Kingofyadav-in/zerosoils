const HANDLERS = {
  'credit': require('./wallet/_credit'),
  '':       require('./wallet/_index'),
}

module.exports = async (req, res) => {
  const action = (req.url || '').replace(/^\/api\/wallet\/?/, '').split('?')[0]
  const handler = HANDLERS[action]
  if (handler) return handler(req, res)
  return res.status(404).json({ error: `Unknown wallet route: ${action}` })
}
