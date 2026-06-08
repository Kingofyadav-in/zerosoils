const HANDLERS = {
  'login':             require('./auth/_login'),
  'register':          require('./auth/_register'),
  'me':                require('./auth/_me'),
  'device':            require('./auth/_device'),
  'devices':           require('./auth/_devices'),
  'forgot-password':   require('./auth/_forgot-password'),
  'reset-password':    require('./auth/_reset-password'),
  'save-hdi':          require('./auth/_save-hdi'),
  'send-email-otp':    require('./auth/_send-email-otp'),
  'send-phone-otp':    require('./auth/_send-phone-otp'),
  'verify-email-otp':  require('./auth/_verify-email-otp'),
  'verify-phone-otp':  require('./auth/_verify-phone-otp'),
}

module.exports = async (req, res) => {
  const action = (req.url || '').replace(/^\/api\/auth\/?/, '').split('?')[0]
  const handler = HANDLERS[action]
  if (handler) return handler(req, res)
  return res.status(404).json({ error: `Unknown auth route: ${action}` })
}
