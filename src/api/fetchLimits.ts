/**
 * 后端列表接口 `page_size` 上限为 500（超出返回 422 Unprocessable Entity）。
 */
export const API_MAX_PAGE_SIZE = 500

/** GET /forecast/details 等：单次拉取条数 */
export const FORECAST_DETAILS_FETCH_PAGE_SIZE = API_MAX_PAGE_SIZE

/** GET 送货历史：全量分页拉取时每页条数 */
export const DELIVERY_HISTORY_FETCH_PAGE_SIZE = API_MAX_PAGE_SIZE
