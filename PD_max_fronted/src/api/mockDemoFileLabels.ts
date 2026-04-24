/**
 * 演示用：按上传文件名（basename）锁定仿真倾向。
 * 浏览器上传通常只有文件名，不含目录；键统一小写以便匹配。
 *
 * tamper  → 仿真锁定为「篡改/可疑」向（与白名单/关键词一致时不出现全图正常）
 * normal  → 仿真锁定为全图、各区域均为「正常」（与演示「没 p 图」素材一致）
 * mixed   → 多样化混合（仍保持真实感波动）
 */
export type MockDemoLabel = 'tamper' | 'normal' | 'mixed'

/** 小写文件名 -> 演示标签 */
export const MOCK_DEMO_FILE_LABELS: Record<string, MockDemoLabel> = {
  // —— 九宫格：仅第 2 张为「没 p」演示；其余锁定为篡改向，避免 mixed 随机成全图正常 ——
  '12df4816fe3d405e80159260e7fa45a9.jpg': 'tamper',
  '130520c15c1a41d4ab3b776782b66274.jpg': 'normal',
  '535097b1c60f4bf98e0e7d9a3b602018.jpg': 'tamper',
  '477314902cb5448292beda263800e681.jpg': 'tamper',
  '24917793050c4ea9ad764a106d106b4f.jpg': 'tamper',
  'b357d87ac82d443a86905c1fa1a21c03.jpg': 'tamper',
  'd1c3ccdf956f47c1b565a11414e9127a.jpg': 'tamper',
  'd9e387645a2d46d4964aeb8ef2d98c5.jpg': 'tamper',
  'de9ba710bd3e4182b347e9ce05fe6806.jpg': 'tamper',

  // 另一常见命名（若你本地文件名不同可命中）
  'd9e387645a2d46d4964aeb8eff2d98c5.jpg': 'tamper',

  // —— 以下均为「未 p 图」演示素材：仿真强制全图+各区域「正常」——
  '2d82b045397c45229d91a725f6240576.jpg': 'normal',
  '28a5084ddbea403ba557bf675dafdc71.jpg': 'normal',
  '75d12b6f9c264a988cfd7ce92bce18e5.jpg': 'normal',
  '85b7d05457c44d98bbebde78bd5b4c8b.jpg': 'normal',
  '402a30ac04af4f86ae570b6edbbce068 (1).jpg': 'normal',
  '402a30ac04af4f86ae570b6edbbce068.jpg': 'normal',
  '2385ce832b314e3db9ce9fbbc340f4ae.jpg': 'normal',
  '4307a7d727844179b0273646b37bcb44 (1).jpg': 'normal',
  '4307a7d727844179b0273646b37bcb44.jpg': 'normal',
  '8639d443deae43a1909df6ff448a4bd7.jpg': 'normal',
  'c3a6ed644bf8425c8f8873af4e8a49eb.jpg': 'normal',
  'f35fab053ee44fc7889d3b6dec1464de.jpg': 'normal',
}

export function demoLabelForFileName(fileName: string): MockDemoLabel | null {
  const base = fileName.trim().split(/[/\\]/).pop() ?? fileName.trim()
  const key = base.toLowerCase()
  return MOCK_DEMO_FILE_LABELS[key] ?? null
}
