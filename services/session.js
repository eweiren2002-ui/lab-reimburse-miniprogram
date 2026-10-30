const KEY = 'lab_procure_session_v1'
const DEFAULT_USER = 'user-yu'

function getUserId() {
  const session = wx.getStorageSync(KEY)
  if (session && session.userId) return session.userId
  const fresh = { userId: DEFAULT_USER }
  wx.setStorageSync(KEY, fresh)
  return fresh.userId
}

function setUserId(userId) {
  wx.setStorageSync(KEY, { userId: userId })
  return userId
}

module.exports = {
  getUserId,
  setUserId,
  DEFAULT_USER
}
