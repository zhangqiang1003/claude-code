# frontend

一个基于 Electron + Vue3 + TypeScript 开发的操作低功耗蓝牙设备的UI。

## 技术栈

- Electron
- Vue
- TypeScript
- Vite
- Element Plus

## 安装

### 安装依赖

> 依赖nodejs，nodejs的版本大于等于16
> npm install

### 启动开发服务器

npm run dev

# 环境变量配置说明

## 概述

本项目支持根据不同环境自动加载对应的环境变量配置文件。

## 配置文件说明

### 1. `.env` - 默认配置文件

- 用于开发环境的默认配置
- 会被 Git 忽略，不会提交到代码库

### 2. `.env.development` - 开发环境配置

- 专门用于开发环境
- 会被 Git 忽略，不会提交到代码库

### 3. `.env.production` - 生产环境配置

- 用于生产打包后的应用
- 会提交到代码库，包含生产环境的配置
- **会被 electron-builder 打包到应用资源中**

### 4. `.env.example` - 配置模板

- 配置文件的示例和说明
- 会提交到代码库

### 5. `.env.development.example` - 开发环境配置模板

- 开发环境配置的示例
- 会提交到代码库

## 环境加载优先级

### 开发环境（`npm run dev`）

1. `.env`
2. `.env.development`
3. 使用默认值：`https://test.dmaodata.cn`

**脚本**：`scripts/dev-server.js` - 设置 `process.env.NODE_ENV = 'development'`

### 生产环境（打包后的应用）

1. 应用安装目录 `.env.production`（打包资源）
2. 资源目录 `.env.production`
3. 工作目录 `.env.production`
4. 使用默认值：`https://test.dmaodata.cn`

**脚本**：`scripts/build.js` - 设置 `process.env.NODE_ENV = 'production'`

## 使用步骤

### 开发环境配置

1. 复制开发环境模板：

   ```bash
   cp .env.development.example .env
   ```

2. 编辑 `.env` 文件，设置开发环境的 API 地址：

   ```bash
   SERVER_BASE_URL=http://127.0.0.1:8205
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

**工作原理**：

- `dev-server.js` 设置 `NODE_ENV=development`
- 主进程读取 `.env` 文件
- Vite 读取 `.env` 文件并通过 `define` 传递给渲染进程

### 生产环境配置

1. 直接编辑 `.env.production` 文件（已包含生产环境默认配置）

2. 打包应用：

   ```bash
   npm run build:win    # Windows
   npm run build:mac    # macOS
   npm run build:linux  # Linux
   ```

3. 打包后的应用会自动使用 `.env.production` 中的配置

**工作原理**：

- `build.js` 设置 `NODE_ENV=production`
- `electron-builder` 将 `.env.production` 打包到应用资源目录
- 主进程从资源目录加载配置

## 环境变量说明

| 变量名            | 说明               | 开发环境示例            | 生产环境示例               |
| ----------------- | ------------------ | ----------------------- | -------------------------- |
| `SERVER_BASE_URL` | API 服务器基础地址 | `http://127.0.0.1:8205` | `https://test.dmaodata.cn` |
| `API_BASE_URL`    | 部分后端接口的地址 | `http://127.0.0.1:8205` | `http://127.0.0.1:8205`    |

## 关键实现细节

### 1. scripts/dev-server.js

```javascript
process.env.NODE_ENV = "development"; // 第1行设置环境
```

### 2. scripts/build.js

```javascript
process.env.NODE_ENV = "production"; // 第1行设置环境
```

### 3. src/main/main.ts

```typescript
// 根据 NODE_ENV 加载对应的配置文件
loadEnvConfig();
```

### 4. vite.config.js

```javascript
// 将环境变量传递给渲染进程
define: {
  'process.env.SERVER_BASE_URL': JSON.stringify(SERVER_BASE_URL),
}
```

## 注意事项

1. **不要提交敏感信息**：`.env` 和 `.env.development` 文件已被 `.gitignore` 忽略
2. **生产配置会打包**：`.env.production` 会通过 `package.json` 的 `build` 配置打包到应用中
3. **主进程和渲染进程**：两个环境都会自动加载对应的环境变量
4. **路径解析**：生产环境会在多个位置查找配置文件，确保打包后能正确加载
