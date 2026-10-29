const { createListPage } = require('../shared/list-page')

Page(createListPage({
  mode: 'applicant',
  title: '我的申请',
  defaultStatus: '',
  detailUrl: '/pages/apply/detail',
  intro: '每条明细都要填写供货单位。列表和详情都会标出经销商。演示数据来自两张中心实验室临时采购表。',
  emptyText: '没有符合条件的申请。可以新建，或在首页恢复演示数据。'
}))
