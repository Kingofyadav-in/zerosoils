const HANDLERS = {
  'create': require('./licences/_create'),
  '':       require('./licences/_index'),
}

module.exports = async (req, res) => {
  const action = (req.url || '').replace(/^\/api\/licences\/?/, '').split('?')[0]
  const handler = HANDLERS[action]
  if (handler) return handler(req, res)
  return res.status(404).json({ error: `Unknown licences route: ${action}` })
}
