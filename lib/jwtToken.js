const { COOKIE_EXPIRE, JWT_SECRET, JWT_EXPIRE } = require('../constant')
const jwt = require('jsonwebtoken')
const sendToken = (user, statusCode, res, isRegisteredShop) => {
  // const token = user.getJWTToken();

  const cookieExpire = COOKIE_EXPIRE

  const options = {
    expires: new Date(Date.now() + cookieExpire * 24 * 60 * 60 * 1000),
    httpOnly: true,
  }

  // user paylod
  const responsePayload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVefified: true,
  }

  const token = jwt.sign(responsePayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  })

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({ success: true, user: responsePayload, token, isRegisteredShop })
}

module.exports = sendToken
