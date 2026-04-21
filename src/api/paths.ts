/**
 * 后端 FastAPI 路由（与 Swagger / openapi.json 一致）。
 * 列表与下拉须用「送货历史」；预测相关为「送货量预测」子路径与「预测」。
 */
export const ApiPaths = {
  deliveryHistory: '/delivery-history',
  deliveryHistoryTemplate: '/delivery-history/模板',
  deliveryHistoryImport: '/delivery-history/import',
  deliveryHistoryBatchDelete: '/delivery-history/批量删除',
  forecastDetail: '/forecast/明细',
  forecastChart: '/forecast/图表',
  forecastExport: '/forecast/导出',
  predict: '/predict',
} as const
