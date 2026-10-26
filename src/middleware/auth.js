const jwt = require('jsonwebtoken');

function exigirLogin(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ erro: 'Não autenticado.' });

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
  }
}

module.exports = exigirLogin;
