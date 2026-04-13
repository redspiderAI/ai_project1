# 单台服务器上配置多个 HTTPS 站点的实战记录

## 1. 目标

这台服务器上需要同时对外提供 5 个入口，并尽可能统一到 HTTPS：

1. `https://redspiderbc.cn/`：宝驰业务管理，是真正的首页。
2. `https://redspiderbc.cn/project1/`：AI 智能比价系统。
3. `https://redspiderbc.cn/project2/`：AI 预测报货数量。
4. `https://redspiderbc.cn:8443/docs`：后端文档，源站是 `http://redspiderbc.cn:8001/docs`。
5. `https://redspiderbc.cn:8444/docs`：TL 比价系统文档，源站是 `http://redspiderbc.cn:8002/docs`。

## 2. 一开始看到的问题

最初的现象不是“443 不通”，而是根路径 `/` 访问后返回了 `404`。通过排查发现：

- `443` 端口是监听着的。
- SSL 证书文件存在。
- `https://redspiderbc.cn/project1/` 可以正常返回 `200`。
- `https://redspiderbc.cn/` 会被转发到 `127.0.0.1:8002`，而这个后端对根路径返回 `404`。

也就是说，问题本质是 Nginx 的路由设计，而不是 HTTPS 本身坏了。

## 3. 排查思路

### 3.1 先确认 Nginx 是否真的在工作

检查了：

- `nginx.conf` 是否包含 `sites-enabled/*`。
- `sites-enabled/pd.conf` 是否为主站入口。
- `listen 80`、`listen 443 ssl` 是否存在。
- 证书文件是否存在。
- 相关端口是否在监听。

结论：

- Nginx 配置结构没有大问题。
- SSL 证书存在。
- 80/443/5177/8001/8002 都有服务在监听。

### 3.2 再确认 docs 页面的类型

访问 `http://127.0.0.1:8001/docs` 和 `http://127.0.0.1:8002/docs` 后发现它们都是 FastAPI Swagger UI。

这类页面有一个关键特点：

- 页面里写死了 `url: '/openapi.json'`。
- 也就是说，它默认认为自己挂在站点根路径上。

这就意味着：

- 不能简单地把两个 Swagger 文档都塞到同一个 `https://redspiderbc.cn/` 下的不同子路径里。
- 如果要同端口同域名共存，要么改应用代码里的文档路径，要么给它们单独分端口、子域名，或者通过更复杂的 Nginx 重写配合应用改造。

## 4. 最终采用的方案

### 4.1 主站 443

`https://redspiderbc.cn/` 作为真正首页，反代到宝驰业务管理，即 `127.0.0.1:5177`。

同时在同一个 443 服务器块里继续承载：

- `/project1/` 静态站点。
- `/project2/` 静态站点。
- `/api/` 反代到 `127.0.0.1:8001`，给前端或接口调试使用。

### 4.2 两个 Swagger 文档单独开 HTTPS 端口

因为它们默认都依赖根路径的 `/openapi.json`，所以采用：

- `8443` -> `127.0.0.1:8001`
- `8444` -> `127.0.0.1:8002`

这样做的好处是：

- 不改后端代码。
- 不和主站首页、项目页冲突。
- 逻辑最清晰，排错最简单。

## 5. 关键 Nginx 配置点

配置文件位置：`/etc/nginx/sites-available/pd.conf`

### 5.1 HTTP 到 HTTPS 跳转

`80` 端口只做两件事：

- `/ai/project1` 旧入口跳转到 `/project1/`。
- 其余请求统一重定向到 HTTPS。

### 5.2 主 HTTPS 入口

`443` 端口负责：

- 首页：`/` -> `127.0.0.1:5177`
- AI 智能比价：`/project1/`
- AI 预测报货：`/project2/`
- 后端接口：`/api/` -> `127.0.0.1:8001`

### 5.3 文档 HTTPS 入口

`8443` 和 `8444` 分别承载两个 Swagger 文档，避免 `openapi.json` 冲突。

## 6. 最终验证方式

修改完成后，必须做两类验证：

### 6.1 Nginx 语法检查

使用：

```bash
sudo nginx -t
```

如果这一步不过，后面的重载和访问测试都没有意义。

### 6.2 curl 连通性测试

建议按下面顺序测：

```bash
curl -skI --max-time 10 https://redspiderbc.cn/
curl -skI --max-time 10 https://redspiderbc.cn/project1/
curl -skI --max-time 10 https://redspiderbc.cn/project2/
curl -skI --max-time 10 https://redspiderbc.cn:8443/docs
curl -skI --max-time 10 https://redspiderbc.cn:8444/docs
```

这次实际测得结果都是 `HTTP/1.1 200 OK`，说明连通性成功。

## 7. 知识点总结

### 7.1 Nginx 的路由优先级

- `location = /xxx` 是精确匹配。
- `location ^~ /xxx/` 会优先于正则和普通前缀。
- `location /` 是兜底入口。

这意味着：

- 你写的兜底 `location /` 很可能会接管很多没单独定义的路径。
- 如果首页不小心被转发到一个没有首页路由的后端，就会返回 `404`。

### 7.2 单域名、多项目共存

常见做法有三种：

1. 用不同路径：`/project1/`、`/project2/`。
2. 用不同子域名：`project1.example.com`、`project2.example.com`。
3. 用不同端口：`8443`、`8444`。

本次方案是“路径 + 端口”混合。

### 7.3 FastAPI Swagger UI 的路径问题

FastAPI 的 `/docs` 默认会引用：

- `/openapi.json`
- `/docs/oauth2-redirect`

所以如果直接挂到子路径下，通常会出现资源找不到或接口文档错位。

## 8. 难点

### 8.1 两个 Swagger 文档不能直接共挂在同一路径

这是本次最容易踩坑的地方。

表面上看都是 `/docs`，但它们内部都默认用根路径资源，直接复用同一个 443 路由会冲突。

### 8.2 证书覆盖范围有限

当前证书只覆盖：

- `redspiderbc.cn`
- `www.redspiderbc.cn`

它没有覆盖额外子域名，所以如果想改成：

- `api.redspiderbc.cn`
- `tl.redspiderbc.cn`

就需要补充证书 SAN。

### 8.3 配置文件权限

`/etc/nginx/sites-available/pd.conf` 是 `root` 拥有，VS Code 远程普通用户不能直接保存，会报：

- `EACCES: permission denied`

正确做法是：

- 用 `sudo tee` 写入。
- 或者用 `sudoedit`。
- 修改后再 `sudo nginx -t` 和 `sudo systemctl reload nginx`。

## 9. 常见误区

### 9.1 误以为“HTTPS 访问不了”就是证书问题

实际可能只是：

- 根路径被转发到了错误的后端。
- 后端返回了 `404`。
- 或者前端静态文件根目录写错了。

### 9.2 误以为同一个域名下可以无限塞多个 `/docs`

Swagger UI 不是纯静态页面，它依赖后端的 OpenAPI 地址。两个 FastAPI 文档直接共挂在同一路径空间里，往往会冲突。

### 9.3 误以为只改 Nginx 就能把所有应用都“变成 HTTPS”

Nginx 只能处理入口和转发。真正的应用要不要知道自己的外部地址、文档路径、回调地址，还是要看后端是否支持这些设置。

## 10. 适合后续复用的操作顺序

1. 先确认服务监听端口。
2. 再确认 Nginx 现有站点和 `server_name`。
3. 用 `curl` 测试每个后端是否健康。
4. 先写配置，再 `nginx -t`。
5. 再 `reload`。
6. 最后再次用 `curl` 测 HTTPS 路由。

## 11. 这次最终结果

- 主站 HTTPS 正常。
- `project1`、`project2` 正常。
- 8001、8002 的 Swagger 文档也能通过 HTTPS 访问。
- Nginx 配置已通过语法检查。
- `curl` 验证已通过。

## 12. project2（AI 预测）前端接口与 405 / 「成功但没数据」

静态页在 `https://redspiderbc.cn/project2/`，但 **API 不应再套一层 `/project2/`**，应与上文 **5.2** 一致：由 **`/api/`（实际多为 `/api/v1/...`）** 反代到 `127.0.0.1:8001`。

### 12.1 推荐做法（与当前 `pd.conf` 设计一致）

- 前端生产环境变量：`VITE_API_BASE=/api/v1`（见仓库 `.env.production`）。
- 浏览器请求：`https://redspiderbc.cn/api/v1/送货历史` 等，与页面是否挂在 `/project2/` **无关**（同源即可）。
- Nginx：在 **443 的 `server` 块**里保证存在对 `/api/v1/`（或已存在的 `/api/` 前缀）到 `8001` 的反代，例如：

```nginx
location ^~ /api/v1/ {
    proxy_pass http://127.0.0.1:8001/api/v1/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

改完后：`sudo nginx -t && sudo systemctl reload nginx`。

### 12.2 若误用 `/project2/api/v1/` 且 Nginx 未单独反代

请求会落到 **`location ^~ /project2/`** 的静态 `try_files`，常见现象：

- **POST** → **405 Not Allowed**（静态目录不允许 POST）。
- **GET** → **200** 但 **Content-Type: text/html**（实际是 SPA 的 `index.html`），前端解析不出 JSON，表格一直空。

若必须走子路径接口，须在 `pd.conf` 里增加 **`location ^~ /project2/api/v1/`** 反代到 `8001`，且该段必须写在 **`location ^~ /project2/`** 静态规则**之前**（更长前缀优先）。详见仓库 `deploy/nginx-project2.conf` 方案 B。

### 12.3 自检命令

```bash
curl -sk --max-time 10 -X POST https://redspiderbc.cn/api/v1/预测 -H 'Content-Type: application/json' -d '{}'
```

应返回 **JSON**（如 422 业务校验），而不是 Nginx 的 **405** 或整页 **HTML**。

### 12.4 实测记录：443 的 `/api/v1/` 与公网 `8001` 可能不是同一套路由

曾对 `送货历史` 列表接口做对比：

- `https://redspiderbc.cn/api/v1/送货历史?...` → `{"detail":"Not Found"}`（仍是 FastAPI JSON，说明进了某台 uvicorn，但**没有该路由**）。
- `http://111.229.25.160:8001/api/v1/送货历史?...` → 正常分页 JSON（`total`、`items`）。

结论：`pd.conf` 里 `/api/v1/` 反代到的进程，与 `111.229.25.160:8001` 上这份 **PD API（OpenAPI 含送货历史/预测）** 不一致。需要运维把 **443 的 `proxy_pass` 指到正确 upstream**，或在本机把「预测模块」后端部署到 Nginx 当前指向的那个 `127.0.0.1:8001`。

在整站不便改动时，仓库提供 **仅 project2 使用的反代**：`location ^~ /project2/api/v1/` → `http://111.229.25.160:8001/api/v1/`（须写在 `location ^~ /project2/` 静态规则**之前**），前端 `.env.production` 使用 `VITE_API_BASE=/project2/api/v1`。详见 `deploy/nginx-project2.conf`。

本机一键对比三条 URL：在项目根目录执行 `powershell -NoProfile -ExecutionPolicy Bypass -File deploy\verify-production-api.ps1`。