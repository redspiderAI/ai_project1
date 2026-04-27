<template>
  <div class="warehouse-distance-config">
    <header class="wdc-header">
      <h2 class="wdc-title">库房距离监测配置</h2>
      <p class="wdc-desc text-muted">配置与监测库房间距离相关项；具体接口与规则接入后可在此页扩展。</p>
    </header>
    <div class="wdc-body card">
      <div class="card-body text-muted">暂无待配置项</div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.warehouse-distance-config {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1rem 2rem;
}
.wdc-header {
  margin-bottom: 1.25rem;
}
.wdc-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.5rem;
}
.wdc-desc {
  margin: 0;
  font-size: 0.95rem;
}
.wdc-body .card-body {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
