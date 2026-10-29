function trim(value) {
  return String(value == null ? '' : value).trim()
}

function roundMoney(value) {
  const num = Number(value)
  if (!isFinite(num)) return 0
  return Math.round(num * 100) / 100
}

function formatMoney(value) {
  const num = roundMoney(value)
  const negative = num < 0
  const fixed = Math.abs(num).toFixed(2)
  const parts = fixed.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (negative ? '-' : '') + parts.join('.')
}

function formatQuantity(value) {
  const num = Number(value)
  if (!isFinite(num)) return ''
  if (Math.abs(num - Math.round(num)) < 1e-9) return String(Math.round(num))
  return String(roundMoney(num))
}

function formatDateCN(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  if (!match) return String(iso || '')
  return match[1] + '年' + Number(match[2]) + '月' + Number(match[3]) + '日'
}

function pad(number) {
  return number < 10 ? '0' + number : String(number)
}

function nowText(date) {
  const current = date || new Date()
  return current.getFullYear() + '-' + pad(current.getMonth() + 1) + '-' + pad(current.getDate()) + ' ' + pad(current.getHours()) + ':' + pad(current.getMinutes())
}

function todayISO(date) {
  const current = date || new Date()
  return current.getFullYear() + '-' + pad(current.getMonth() + 1) + '-' + pad(current.getDate())
}

function formatSize(size) {
  const bytes = Number(size) || 0
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function brief(text, max) {
  const value = trim(text)
  if (value.length <= max) return value
  return value.slice(0, max) + '…'
}

module.exports = {
  trim,
  roundMoney,
  formatMoney,
  formatQuantity,
  formatDateCN,
  nowText,
  todayISO,
  formatSize,
  brief
}
