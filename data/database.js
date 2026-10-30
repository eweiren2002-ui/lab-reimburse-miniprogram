const seed = require('./seed')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function freshDatabase() {
  return {
    version: 1,
    hospital: clone(seed.hospital),
    users: clone(seed.users),
    dealers: clone(seed.dealers),
    catalog: clone(seed.catalog),
    applications: clone(seed.applications)
  }
}

module.exports = {
  freshDatabase,
  seed
}
