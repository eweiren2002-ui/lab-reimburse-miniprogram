/**
 * 页面只依赖这里的方法。local / cloud 两种驱动的函数名相同。
 *
 * ensureReady()
 * getCurrentUser()
 * setRole(role)                 // 'applicant' | 'mentor'
 * resetDemo()
 * home()
 * queryApplications(query)
 * getPresentedApplication(id)
 * prepareEditor(id)
 * saveDraft(form)
 * submitForm(form)
 * withdraw(id)
 * decide(id, { result, comment })
 * saveInvoice(id, { note, files })
 * listDealers()
 */
const config = require('../config')
const domain = require('../domain/applications')
const { nowText, todayISO, formatMoney, formatSize } = require('../domain/format')
const session = require('./session')
const localDriver = require('./driver.local')
const cloudDriver = require('./driver.cloud')

function currentDriver() {
  if (config.driver === 'cloud') return cloudDriver
  if (config.driver === 'local') return localDriver
  throw new Error('未知数据驱动：' + config.driver)
}

function ensureReady() {
  return currentDriver().ensureReady()
}

function loadContext() {
  return ensureReady().then(() => currentDriver().loadState()).then((state) => {
    const userId = session.getUserId()
    const users = state.users || []
    const user = users.find((item) => item.id === userId) || users[0]
    if (!user) throw new Error('没有可用的用户')
    return { user: user, state: state }
  })
}

function getCurrentUser() {
  return loadContext().then((ctx) => ctx.user)
}

function setRole(role) {
  return loadContext().then((ctx) => {
    const user = (ctx.state.users || []).find((item) => item.role === role)
    if (!user) throw new Error('没有该身份的演示账号')
    session.setUserId(user.id)
    return user
  })
}

function resetDemo() {
  return currentDriver().resetDemo()
}

function listDealers() {
  return loadContext().then((ctx) => ctx.state.dealers || [])
}

function home() {
  return loadContext().then((ctx) => {
    const mine = ctx.user.role === 'applicant'
      ? ctx.state.applications.filter((app) => app.applicantId === ctx.user.id)
      : ctx.state.applications.slice()
    const pending = mine.filter((app) => app.status === 'pending')
    const recent = mine.slice().sort((left, right) => (left.applyDate < right.applyDate ? 1 : -1)).slice(0, 4)
    return {
      user: ctx.user,
      hospitalName: ctx.state.hospital.name,
      formTitle: ctx.state.hospital.formTitle,
      departmentName: ctx.state.hospital.department,
      driver: config.driver,
      counts: domain.countByStatus(mine),
      pendingAmountText: formatMoney(domain.sumEstimated(pending)),
      recent: recent.map((app) => domain.presentCard(app))
    }
  })
}

function queryApplications(query) {
  return loadContext().then((ctx) => {
    const criteria = Object.assign({}, query || {})
    const apps = domain.filterApplications(ctx.state.applications, criteria, ctx.state.dealers)
    const chipSource = domain.filterApplications(ctx.state.applications, {
      applicantId: criteria.applicantId,
      status: criteria.status,
      keyword: criteria.keyword
    }, ctx.state.dealers)
    return {
      role: ctx.user.role,
      cards: apps.map((app) => domain.presentCard(app)),
      dealerGroups: domain.presentDealerGroups(apps, ctx.state.dealers),
      dealerOptions: domain.dealerChips(chipSource, ctx.state.dealers, criteria.dealerId || ''),
      statusOptions: domain.STATUS_OPTIONS
    }
  })
}

function getPresentedApplication(id) {
  return loadContext().then((ctx) => {
    const app = (ctx.state.applications || []).find((item) => item.id === id)
    if (!app) throw new Error('未找到该申请')
    if (ctx.user.role !== 'mentor' && app.applicantId !== ctx.user.id) {
      throw new Error('只能查看自己的申请')
    }
    return {
      user: ctx.user,
      app: domain.presentApplication(app)
    }
  })
}

function prepareEditor(id) {
  return loadContext().then((ctx) => {
    if (ctx.user.role !== 'applicant') {
      throw new Error('请切换到学生/申请人后再新建或编辑申请')
    }
    let app = null
    if (id) {
      app = (ctx.state.applications || []).find((item) => item.id === id)
      if (!app) throw new Error('未找到该申请')
      if (app.applicantId !== ctx.user.id) throw new Error('只能编辑自己的申请')
      if (app.status !== 'draft' && app.status !== 'rejected') {
        throw new Error('只有草稿或已驳回的申请可以编辑')
      }
    }
    return {
      user: ctx.user,
      dealers: ctx.state.dealers,
      catalog: ctx.state.catalog || [],
      app: app
    }
  })
}

function prepareEditable(form, ctx) {
  const normalized = domain.normalizeForm(form, {
    user: ctx.user,
    now: nowText(),
    today: todayISO(),
    applications: ctx.state.applications,
    hospital: ctx.state.hospital
  })
  const previous = (ctx.state.applications || []).find((item) => item.id === normalized.id)
  if (previous && previous.applicantId !== ctx.user.id) throw new Error('只能修改自己的申请')
  if (previous && previous.status !== 'draft' && previous.status !== 'rejected') {
    throw new Error('只有草稿或已驳回的申请可以编辑')
  }
  if (previous) {
    normalized.createdAt = previous.createdAt
    normalized.submittedAt = previous.submittedAt || ''
    normalized.sourceLabel = previous.sourceLabel
    normalized.printedEstimate = previous.printedEstimate || normalized.printedEstimate
    normalized.hospitalName = previous.hospitalName
    normalized.formTitle = previous.formTitle
    if (!form.invoice) normalized.invoice = previous.invoice
  }
  return normalized
}

function persist(dealers, application) {
  return currentDriver().saveDealers(dealers).then(() => currentDriver().saveApplication(application)).then(() => application)
}

function saveDraft(form) {
  return loadContext().then((ctx) => {
    if (ctx.user.role !== 'applicant') throw new Error('请切换到学生/申请人后再保存')
    const normalized = prepareEditable(form, ctx)
    if (!domain.hasDraftContent(normalized)) throw new Error('请先填写申请理由或至少一条明细')
    const draft = domain.markDraft(normalized, nowText())
    const attached = domain.attachDealers(ctx.state.dealers, draft)
    return persist(attached.dealers, attached.application)
  })
}

function submitForm(form) {
  return loadContext().then((ctx) => {
    if (ctx.user.role !== 'applicant') throw new Error('请切换到学生/申请人后再提交')
    const normalized = prepareEditable(form, ctx)
    const errors = domain.validateApplication(normalized)
    if (errors.length) {
      const error = new Error(errors.join('\n'))
      error.errors = errors
      throw error
    }
    const submitted = domain.markSubmitted(normalized, nowText())
    const attached = domain.attachDealers(ctx.state.dealers, submitted)
    return persist(attached.dealers, attached.application)
  })
}

function withdraw(id) {
  return loadContext().then((ctx) => {
    if (ctx.user.role !== 'applicant') throw new Error('请切换到学生/申请人后再撤回')
    const previous = (ctx.state.applications || []).find((item) => item.id === id)
    if (!previous) throw new Error('未找到该申请')
    if (previous.applicantId !== ctx.user.id) throw new Error('只能撤回自己的申请')
    if (previous.status !== 'pending') throw new Error('只有待审批的申请可以撤回')
    const next = Object.assign({}, previous, { status: 'draft', updatedAt: nowText() })
    return currentDriver().saveApplication(next).then(() => next)
  })
}

function decide(id, payload) {
  return loadContext().then((ctx) => {
    if (ctx.user.role !== 'mentor') throw new Error('请切换到导师后再审批')
    const previous = (ctx.state.applications || []).find((item) => item.id === id)
    if (!previous) throw new Error('未找到该申请')
    if (previous.status !== 'pending') throw new Error('只有待审批的申请可以通过或驳回')
    const result = payload && payload.result
    const comment = payload && payload.comment ? String(payload.comment).trim() : ''
    if (result !== 'approved' && result !== 'rejected') throw new Error('无效的审批结果')
    if (result === 'rejected' && !comment) throw new Error('驳回时请填写审批意见')
    const next = Object.assign({}, previous, {
      status: result,
      decision: {
        result: result,
        comment: comment,
        reviewerId: ctx.user.id,
        reviewerName: ctx.user.name,
        reviewerRole: 'mentor',
        time: nowText()
      },
      updatedAt: nowText()
    })
    return currentDriver().saveApplication(next).then(() => next)
  })
}

function saveInvoice(id, payload) {
  return loadContext().then((ctx) => {
    if (ctx.user.role !== 'applicant') throw new Error('由申请人登记发票')
    const previous = (ctx.state.applications || []).find((item) => item.id === id)
    if (!previous) throw new Error('未找到该申请')
    if (previous.applicantId !== ctx.user.id) throw new Error('只能给自己的申请登记发票')
    if (previous.status !== 'pending' && previous.status !== 'approved') {
      throw new Error('提交之后才能登记发票')
    }
    const note = payload && payload.note ? String(payload.note).trim() : ''
    const files = ((payload && payload.files) || []).map((file) => ({
      name: (file.name || '未命名附件').trim(),
      size: Number(file.size) || 0,
      sizeText: file.sizeText || formatSize(file.size),
      addedAt: file.addedAt || nowText()
    }))
    if (!note && !files.length) throw new Error('请填写发票说明或添加附件')
    const next = Object.assign({}, previous, {
      invoice: { note: note, files: files },
      updatedAt: nowText()
    })
    return currentDriver().saveApplication(next).then(() => next)
  })
}

module.exports = {
  ensureReady,
  getCurrentUser,
  setRole,
  resetDemo,
  home,
  queryApplications,
  getPresentedApplication,
  prepareEditor,
  saveDraft,
  submitForm,
  withdraw,
  decide,
  saveInvoice,
  listDealers
}
