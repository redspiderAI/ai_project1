<template>
  <div class="user-manage-page">
    <div class="card shadow-sm">
      <div class="card-body">
        <div class="toolbar">
          <div class="left-tools">
            <input v-model.trim="keyword" class="form-control form-control-sm" placeholder="用户名/姓名关键字" />
            <select v-model="roleFilter" class="form-select form-select-sm">
                <option value="">全部角色</option>
                <option value="admin">管理员</option>
                <option value="user">普通用户</option>
            </select>
            <button class="btn btn-sm btn-outline-primary" @click="loadUsers(1)">查询</button>
          </div>
          <button class="btn btn-sm btn-success" @click="openCreateModal">新增用户</button>
        </div>

        <div v-if="errorText" class="alert alert-warning mt-3 mb-0">{{ errorText }}</div>

        <div class="table-wrap">
          <table class="table table-sm table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 70px">ID</th>
                <th>用户名</th>
                <th>姓名</th>
                <th style="width: 120px">角色</th>
                <th>手机号</th>
                <th>邮箱</th>
                <th style="width: 260px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="text-center py-4">加载中...</td>
              </tr>
              <tr v-else-if="users.length === 0">
                <td colspan="7" class="text-center py-4 text-muted">暂无用户数据</td>
              </tr>
              <tr v-for="u in users" :key="u.id">
                <td>{{ u.id }}</td>
                <td>{{ u.username }}</td>
                <td>{{ u.real_name || '-' }}</td>
                <td>
                  <span class="badge rounded-pill text-bg-primary">{{ roleText(u.role) }}</span>
                </td>
                <td>{{ u.phone || '-' }}</td>
                <td>{{ u.email || '-' }}</td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn-sm btn-outline-primary" @click="openRoleModal(u)">改角色</button>
                    <button class="btn btn-sm btn-outline-warning" @click="openPasswordModal(u)">改密码</button>
                    <button class="btn btn-sm btn-outline-danger" @click="confirmDelete(u)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pager">
          <button class="btn btn-sm btn-outline-secondary" :disabled="page <= 1" @click="loadUsers(page - 1)">
            上一页
          </button>
          <span class="pager-text">第 {{ page }} 页 / 共 {{ totalPages }} 页（{{ total }} 条）</span>
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="page >= totalPages"
            @click="loadUsers(page + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCreate" class="mask">
      <div class="dialog card">
        <div class="card-body">
          <h6 class="mb-3">新增用户</h6>
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label">用户名</label>
              <input
                v-model.trim="createForm.username"
                class="form-control form-control-sm"
                autocomplete="off"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">姓名</label>
              <input
                v-model.trim="createForm.real_name"
                class="form-control form-control-sm"
                autocomplete="off"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">密码</label>
              <input
                v-model.trim="createForm.password"
                type="password"
                class="form-control form-control-sm"
                autocomplete="new-password"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">角色</label>
              <select v-model="createForm.role" class="form-select form-select-sm">
                <option value="admin">管理员</option>
                <option value="user">普通用户</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">手机号</label>
              <input
                v-model.trim="createForm.phone"
                class="form-control form-control-sm"
                autocomplete="off"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">邮箱</label>
              <input
                v-model.trim="createForm.email"
                class="form-control form-control-sm"
                autocomplete="off"
              />
            </div>
          </div>
          <div class="dialog-actions mt-3">
            <button class="btn btn-sm btn-secondary" @click="showCreate = false">取消</button>
            <button class="btn btn-sm btn-primary" :disabled="submitting" @click="submitCreate">保存</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showRole" class="mask">
      <div class="dialog card">
        <div class="card-body">
          <h6 class="mb-3">修改角色</h6>
          <div class="mb-2">用户：{{ currentUser?.username }}</div>
          <select v-model="roleValue" class="form-select form-select-sm">
            <option value="admin">管理员</option>
            <option value="user">普通用户</option>
          </select>
          <div class="dialog-actions mt-3">
            <button class="btn btn-sm btn-secondary" @click="showRole = false">取消</button>
            <button class="btn btn-sm btn-primary" :disabled="submitting" @click="submitRole">保存</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showPassword" class="mask">
      <div class="dialog card">
        <div class="card-body">
          <h6 class="mb-3">修改密码</h6>
          <div class="mb-2">用户：{{ currentUser?.username }}</div>
          <div class="mb-2">
            <label class="form-label">管理员密钥</label>
            <input v-model.trim="pwdForm.admin_key" type="password" class="form-control form-control-sm" />
          </div>
          <div class="mb-2">
            <label class="form-label">新密码</label>
            <input v-model.trim="pwdForm.new_password" type="password" class="form-control form-control-sm" />
          </div>
          <div class="dialog-actions mt-3">
            <button class="btn btn-sm btn-secondary" @click="showPassword = false">取消</button>
            <button class="btn btn-sm btn-primary" :disabled="submitting" @click="submitPassword">保存</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  changeUserPassword,
  createUser,
  deleteUser,
  fetchUsers,
  updateUserRole,
  type UserRow,
} from '../api/authApi'

const users = ref<UserRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const roleFilter = ref('')
const loading = ref(false)
const submitting = ref(false)
const errorText = ref('')

const showCreate = ref(false)
const showRole = ref(false)
const showPassword = ref(false)
const currentUser = ref<UserRow | null>(null)
const roleValue = ref('user')

const createForm = ref({
  username: '',
  real_name: '',
  password: '',
  role: 'user',
  phone: '',
  email: '',
})

const pwdForm = ref({
  admin_key: '',
  new_password: '',
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function loadUsers(nextPage = page.value) {
  loading.value = true
  errorText.value = ''
  try {
    const data = await fetchUsers({
      keyword: keyword.value || undefined,
      role: roleFilter.value || undefined,
      page: nextPage,
      page_size: pageSize.value,
    })
    users.value = data.items
    total.value = data.total
    page.value = nextPage
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  createForm.value = {
    username: '',
    real_name: '',
    password: '',
    role: 'user',
    phone: '',
    email: '',
  }
  showCreate.value = true
}

async function submitCreate() {
  if (!createForm.value.username || !createForm.value.password) {
    alert('用户名和密码必填')
    return
  }
  submitting.value = true
  try {
    await createUser({
      username: createForm.value.username,
      real_name: createForm.value.real_name,
      password: createForm.value.password,
      role: createForm.value.role,
      phone: createForm.value.phone || undefined,
      email: createForm.value.email || undefined,
    })
    showCreate.value = false
    await loadUsers(1)
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
  } finally {
    submitting.value = false
  }
}

function openRoleModal(u: UserRow) {
  currentUser.value = u
  roleValue.value = u.role || 'user'
  showRole.value = true
}

async function submitRole() {
  if (!currentUser.value) return
  submitting.value = true
  try {
    await updateUserRole(currentUser.value.id, roleValue.value)
    showRole.value = false
    await loadUsers(page.value)
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
  } finally {
    submitting.value = false
  }
}

function openPasswordModal(u: UserRow) {
  currentUser.value = u
  pwdForm.value = { admin_key: '', new_password: '' }
  showPassword.value = true
}

async function submitPassword() {
  if (!currentUser.value) return
  if (!pwdForm.value.admin_key || !pwdForm.value.new_password) {
    alert('管理员密钥和新密码必填')
    return
  }
  submitting.value = true
  try {
    await changeUserPassword(currentUser.value.id, pwdForm.value.admin_key, pwdForm.value.new_password)
    showPassword.value = false
    alert('密码修改成功')
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
  } finally {
    submitting.value = false
  }
}

async function confirmDelete(u: UserRow) {
  if (!confirm(`确认删除用户「${u.username}」吗？`)) return
  submitting.value = true
  try {
    await deleteUser(u.id)
    await loadUsers(page.value)
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void loadUsers(1)
})

function roleText(role: string | undefined) {
  if (role === 'admin') return '管理员'
  if (role === 'user') return '普通用户'
  return role || '-'
}
</script>

<style scoped>
.user-manage-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.left-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.left-tools .form-control,
.left-tools .form-select {
  width: 180px;
}

.table-wrap {
  margin-top: 12px;
  overflow: auto;
}

.action-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}

.pager-text {
  font-size: 13px;
  color: #4b5563;
}

.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.dialog {
  width: min(680px, 100%);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
