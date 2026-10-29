const { createListPage } = require('../shared/list-page')

Page(createListPage({
  mode: 'mentor',
  title: '待审批',
  defaultStatus: 'pending',
  detailUrl: '/pages/approve/detail',
  intro: '默认显示待审批。可按经销商把明细合在一起看，再进入单据通过或驳回。',
  emptyText: '没有符合条件的申请。'
}))
