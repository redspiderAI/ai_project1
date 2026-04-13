/**
 * 后端 FastAPI 路由（与 Swagger / openapi.json 一致）。
 * 列表与下拉须用「送货历史」；预测相关为「送货量预测」子路径与「预测」。
 */
export const ApiPaths = {
  deliveryHistory: '送货历史',
  deliveryHistoryTemplate: '送货历史/模板',
  deliveryHistoryImport: '送货历史/import',
  deliveryHistoryBatchDelete: '送货历史/批量删除',
  forecastDetail: '送货量预测/明细',
  forecastChart: '送货量预测/图表',
  forecastExport: '送货量预测/导出',
  predict: '预测',
} as const
