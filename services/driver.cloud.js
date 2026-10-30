const { freshDatabase } = require('../data/database')

function database() {
  if (!wx.cloud) return Promise.reject(new Error('当前基础库没有云开发能力'))
  return Promise.resolve(wx.cloud.database())
}

function clean(doc) {
  const next = Object.assign({}, doc)
  delete next._id
  delete next._openid
  return next
}

function loadCollection(db, name) {
  return db.collection(name).limit(100).get().then((res) => (res.data || []).map(clean))
}

function upsert(db, name, doc) {
  const data = clean(doc)
  return db.collection(name).where({ id: data.id }).limit(1).get().then((res) => {
    if (res.data && res.data.length) {
      return db.collection(name).doc(res.data[0]._id).update({ data: data })
    }
    return db.collection(name).add({ data: data })
  })
}

function ensureReady() {
  return database().then((db) => {
    return db.collection('applications').limit(1).get().then((res) => {
      if (res.data && res.data.length) return null
      const fresh = freshDatabase()
      const tasks = []
      fresh.users.forEach((doc) => tasks.push(db.collection('users').add({ data: doc })))
      fresh.dealers.forEach((doc) => tasks.push(db.collection('dealers').add({ data: doc })))
      fresh.catalog.forEach((doc) => tasks.push(db.collection('catalog').add({ data: doc })))
      fresh.applications.forEach((doc) => tasks.push(db.collection('applications').add({ data: doc })))
      return Promise.all(tasks)
    })
  })
}

function resetDemo() {
  return Promise.reject(new Error('云开发模式不在手机端清空数据库，请到云开发控制台处理'))
}

function loadState() {
  return database().then((db) => {
    return Promise.all([
      loadCollection(db, 'users'),
      loadCollection(db, 'dealers'),
      loadCollection(db, 'catalog'),
      loadCollection(db, 'applications')
    ]).then((parts) => {
      const fresh = freshDatabase()
      return {
        version: 1,
        hospital: fresh.hospital,
        users: parts[0].length ? parts[0] : fresh.users,
        dealers: parts[1],
        catalog: parts[2],
        applications: parts[3]
      }
    })
  })
}

function saveApplication(app) {
  return database().then((db) => upsert(db, 'applications', app).then(() => app))
}

function saveDealers(dealers) {
  return database().then((db) => {
    return Promise.all(dealers.map((dealer) => upsert(db, 'dealers', dealer))).then(() => dealers)
  })
}

module.exports = {
  ensureReady,
  resetDemo,
  loadState,
  saveApplication,
  saveDealers
}
