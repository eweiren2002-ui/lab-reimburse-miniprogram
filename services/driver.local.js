const { freshDatabase } = require('../data/database')

const KEY = 'lab_procure_db_v1'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function read() {
  const state = wx.getStorageSync(KEY)
  if (!state || state.version !== 1 || !state.applications || !state.dealers || !state.users) {
    const fresh = freshDatabase()
    wx.setStorageSync(KEY, fresh)
    return fresh
  }
  return state
}

function ensureReady() {
  read()
  return Promise.resolve()
}

function resetDemo() {
  wx.setStorageSync(KEY, freshDatabase())
  return Promise.resolve()
}

function loadState() {
  return Promise.resolve(clone(read()))
}

function saveApplication(app) {
  const state = clone(read())
  const index = state.applications.findIndex((item) => item.id === app.id)
  if (index >= 0) state.applications[index] = app
  else state.applications.push(app)
  wx.setStorageSync(KEY, state)
  return Promise.resolve(app)
}

function saveDealers(dealers) {
  const state = clone(read())
  state.dealers = dealers
  wx.setStorageSync(KEY, state)
  return Promise.resolve(dealers)
}

module.exports = {
  ensureReady,
  resetDemo,
  loadState,
  saveApplication,
  saveDealers
}
