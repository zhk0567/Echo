# Echo 日记

一款本地化的个人日记桌面应用，温暖纸张风格，数据完全保存在本机。

## 功能

- 月历浏览与快速跳转，有日记的日期按字数深浅高亮
- 笔记本风格编辑器（横线、左侧红线、纸张纹理）
- 自动保存，支持小 / 中 / 大字號
- 专注模式（隐藏侧边栏，`Esc` 退出）
- 全文搜索，关键词高亮
- 写作统计：累计篇数、字数、本月字数、连续写作天数
- 从 `日记.txt` 一键迁移至 JSON 格式

## 技术栈

- **桌面端**：Electron 33
- **前端**：React 18 + TypeScript + Vite
- **数据**：本地 `entries/` 目录，每条日记一个 JSON 文件

## 环境要求

- [Node.js](https://nodejs.org/) 18 或更高版本
- Windows（开发与打包主要针对 Windows）

## 快速开始

```powershell
# 克隆项目
git clone git@github.com:zhk0567/Echo.git
cd Echo

# 安装依赖
npm install

# 若存在 日记.txt，迁移到 entries/
npm run migrate

# 启动应用
.\start.ps1
# 或
npm run dev
```

首次运行 `start.ps1` 会自动安装依赖、迁移数据并启动应用。若已打包，会优先启动 `release/` 下的便携版。

## 常用命令

| 命令 | 说明 |
|------|------|
| `.\start.ps1` | 一键启动（推荐） |
| `npm run dev` | 开发模式 |
| `npm run migrate` | 将 `日记.txt` 迁移为 JSON |
| `npm run build` | 打包到 `release/` 目录 |

## 数据目录

```
Echo/
├── entries/          # 日记 JSON（运行时生成，默认不提交到 Git）
│   └── 2026-01-01.json
├── 日记.txt          # 原始 txt 备份（可选，只读）
└── ...
```

每条日记的 JSON 格式：

```json
{
  "date": "2026-01-01",
  "content": "正文内容...",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-06-07T12:00:00.000Z"
}
```

应用只读写 `entries/`，不会修改 `日记.txt`。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+S` | 手动保存 |
| `Ctrl+K` | 聚焦搜索框 |
| `Alt+←` / `Alt+→` | 切换上 / 下一天 |
| `Esc` | 退出专注模式 |

## 项目结构

```
├── electron/           # Electron 主进程与 IPC
├── src/                # React 前端
│   ├── components/     # 界面组件
│   ├── lib/            # 工具函数
│   └── styles/         # 样式
├── scripts/            # 迁移脚本
├── start.ps1           # Windows 启动脚本
└── package.json
```

## 许可证

个人项目，仅供学习与自用。
