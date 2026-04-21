/**
 * 后端 FastAPI 路由（与 Swagger / openapi.json 一致）。
 * 送货历史、送货量预测、预测模块等路径已统一为英文 segment（如 chart、details、export、template、batch-delete）。
 */
export const ApiPaths = {
  /** 列表/查询主路径（未改名则保持） */
  deliveryHistory: '/delivery-history',
  deliveryHistoryTemplate: '/delivery-history/template',
  deliveryHistoryImport: '/delivery-history/import',
  deliveryHistoryBatchDelete: '/delivery-history/batch-delete',
  forecastDetail: '/forecast/details',
  forecastChart: '/forecast/chart',
  forecastExport: '/forecast/export',
  /** 预测模块前缀；子路径示例：/predict/operation-audit、/predict/async、/predict/results、batches/{id} 等由后端挂载 */
  predict: '/predict',
} as const
