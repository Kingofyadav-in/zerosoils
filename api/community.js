const HANDLERS = {
  'comments': require('./community/_comments'),
  'posts':    require('./community/_posts'),
  'react':    require('./community/_react'),
  'report':   require('./community/_report'),
}

module.exports = async (req, res) => {
  const action = (req.url || '').replace(/^\/api\/community\/?/, '').split('?')[0]
  const handler = HANDLERS[action]
  if (handler) return handler(req, res)
  return res.status(404).json({ error: `Unknown community route: ${action}` })
}
