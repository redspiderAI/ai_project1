/**
 * 电子地图「演示打点」数据：5 处冶炼厂 + 5 处仓库（有色金属物流/交割场景示例）。
 * 坐标为 GCJ-02（国测局加密坐标），与页面所用高德瓦片一致；其中贵溪冶炼厂经纬度来自企业公开环评文件，其余为按公开地址地图定位的约数，仅作 UI 演示，非测绘成果。
 */

export type DemonstrationMapPoint = {
  id: string
  kind: 'smelter' | 'warehouse'
  title: string
  address: string
  lat: number
  lng: number
  note: string
  /** 数据说明，便于弹窗展示 */
  sourceLabel: string
  sourceUrl?: string
}

/** 5 冶炼厂 + 5 仓库，共 10 点 */
export const mapDemonstrationPoints: DemonstrationMapPoint[] = [
  {
    id: 'demo-guixi-smelter',
    kind: 'smelter',
    title: '江西铜业股份有限公司贵溪冶炼厂',
    address: '江西省鹰潭市贵溪市北郊滨江乡（贵溪工业区内）',
    lat: 28.329914,
    lng: 117.225156,
    note: '环评公开文件载明厂区中心经纬度：东经 117.225156°、北纬 28.329914°。',
    sourceLabel: '江西铜业公开环评文件（地理位置章节）',
    sourceUrl: 'https://www.jxcc.com/uploadFiles/file/20190924/1569291099138031396.pdf',
  },
  {
    id: 'demo-tl-jinguan-smelter',
    kind: 'smelter',
    title: '铜陵有色金属集团股份有限公司金冠铜业分公司',
    address: '安徽省铜陵市经济开发区西湖二路西1号',
    lat: 30.9386,
    lng: 117.8079,
    note: '工商登记/百科所载营业地址；坐标为按该地址地图定位的约数。',
    sourceLabel: '百度百科等企业公开信息（地址）',
    sourceUrl: 'https://baike.baidu.hk/item/%E9%8A%85%E9%99%B5%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%AC%E9%9B%86%E5%9C%98%E8%82%A1%E4%BB%BD%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8%E9%87%91%E5%86%A0%E9%8A%85%E6%A5%AD%E5%88%86%E5%85%AC%E5%8F%B8/51691758',
  },
  {
    id: 'demo-jinchuan-smelter',
    kind: 'smelter',
    title: '金川集团股份有限公司（金昌有色金属基地）',
    address: '甘肃省金昌市金川区',
    lat: 38.5138,
    lng: 102.1886,
    note: '我国重要镍钴铜生产基地；坐标为金昌城区/厂区常用地图参考点（约数）。',
    sourceLabel: '公开地理信息与集团介绍（地址层级）',
  },
  {
    id: 'demo-shaoguan-smelter',
    kind: 'smelter',
    title: '深圳市中金岭南有色金属股份有限公司韶关冶炼厂',
    address: '广东省韶关市浈江区十里亭一带（冶炼厂区）',
    lat: 24.8533,
    lng: 113.5856,
    note: '韶关冶炼厂为老牌铅锌冶炼企业；坐标为按韶关北郊工业区地图参考的约数。',
    sourceLabel: '企业公开资料与地图（约数坐标）',
  },
  {
    id: 'demo-huludao-smelter',
    kind: 'smelter',
    title: '葫芦岛锌业股份有限公司（锌冶炼厂区）',
    address: '辽宁省葫芦岛市龙港区',
    lat: 40.7589,
    lng: 120.9512,
    note: '葫芦岛市大型锌冶炼企业；坐标为龙港区沿江/厂区常用参考点（约数）。',
    sourceLabel: '公开企业信息与地图（约数坐标）',
  },
  {
    id: 'demo-zhongchu-nanda',
    kind: 'warehouse',
    title: '中储发展股份有限公司（南大路库区）',
    address: '上海市宝山区南大路137号、310号（上期所交割仓库公示地址）',
    lat: 31.3035,
    lng: 121.3828,
    note: '上海期货交易所镍/锡等品种指定交割仓库公示地址。',
    sourceLabel: '上海期货交易所-仓库信息',
    sourceUrl: 'https://www.shfe.com.cn/products/futures/metal/nonferrousmetal/sn_f/warehouses/',
  },
  {
    id: 'demo-guochu-tianwei',
    kind: 'warehouse',
    title: '上海国储天威仓储有限公司',
    address: '上海市嘉定区黄渡工业园区星塔路1289号',
    lat: 31.2558,
    lng: 121.2195,
    note: '上期所公示的指定交割仓库。',
    sourceLabel: '上海期货交易所-仓库信息',
    sourceUrl: 'https://www.shfe.com.cn/products/futures/metal/nonferrousmetal/ni_f/warehouses/',
  },
  {
    id: 'demo-shanggang-andalu',
    kind: 'warehouse',
    title: '上港云仓（上海）仓储管理有限公司',
    address: '上海市宝山区安达路240号',
    lat: 31.4042,
    lng: 121.4568,
    note: '上期所集团交割库公示地址。',
    sourceLabel: '上海期货交易所-仓库信息',
    sourceUrl: 'https://www.shfe.com.cn/products/futures/metal/nonferrousmetal/ni_f/warehouses/',
  },
  {
    id: 'demo-sinotrans-hongjing',
    kind: 'warehouse',
    title: '中国外运华东有限公司（虹井路库区）',
    address: '上海市闵行区虹井路865号',
    lat: 31.1792,
    lng: 121.3715,
    note: '上期所白银等品种曾公示的交割仓库地址之一。',
    sourceLabel: '上海期货交易所-白银指定交割仓库名单',
    sourceUrl: 'https://www.shfe.com.cn/products/futures/metal/ferrousandpreciousmetal/ag_f/attach/202101/t20210101_796923.html',
  },
  {
    id: 'demo-quansheng-caoan',
    kind: 'warehouse',
    title: '上海全胜物流股份有限公司',
    address: '上海市嘉定区曹安公路3645号',
    lat: 31.2916,
    lng: 121.2324,
    note: '上期所锡期货指定交割仓库公示地址。',
    sourceLabel: '上海期货交易所-仓库信息',
    sourceUrl: 'https://www.shfe.com.cn/products/futures/metal/nonferrousmetal/sn_f/warehouses/',
  },
]
