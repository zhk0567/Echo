# Echo 日记

一款本地化的个人日记桌面应用，温暖墨感横线稿纸风格，数据完全保存在本机。

## 功能

- 月历浏览与快速跳转，有日记的日期按字数深浅高亮
- 墨感横线稿纸编辑器（深褐墨色正文、清晰行线），支持小 / 中 / 大字号
- 自动保存，专注模式（隐藏侧边栏）
- 全文搜索，关键词高亮，键盘选择结果
- 写作统计：累计篇数、字数、本月字数、连续写作天数
- **AI 助手**（需本机 Ollama）：编辑器侧栏对话、数据分析页洞察生成
- 从 `日记.txt` 或 `zhita_settings.xlsx` 导入历史日记

## 技术栈

- **桌面端**：Electron 33
- **前端**：React 18 + TypeScript + Vite
- **数据**：本地 `entries/` 目录，每条日记一个 JSON 文件

## 环境要求

- [Node.js](https://nodejs.org/) 18 或更高版本
- Windows（开发与打包主要针对 Windows）
- （可选）[Ollama](https://ollama.com/)：启用 AI 助手与数据分析洞察

## Ollama AI（可选）

Echo 通过本机 Ollama（默认 `http://127.0.0.1:11434`）调用模型 **`nemotron-3-super:cloud`**。该模型为 Ollama Cloud 模型，日记正文或统计摘要会经本机 Ollama 转发至云端推理，请确保已登录 Ollama 账户。

```powershell
# 1. 安装并启动 Ollama（保持后台运行）
# 2. 拉取默认模型
ollama pull nemotron-3-super:cloud
```

| 功能 | 入口 |
|------|------|
| 日记 AI 对话 | 编辑器工具栏「AI」按钮，基于当前日期与正文 |
| 写作洞察 | 数据分析页「生成 AI 洞察」，基于统计数据 |

Ollama 未启动或模型未安装时，界面会显示引导提示，不会影响日记读写。

## 快速开始

```powershell
# 克隆项目
git clone git@github.com:zhk0567/Echo.git
cd Echo

# 安装依赖
npm install

# 若存在 日记.txt，迁移到 entries/
npm run migrate

# 若存在 zhita_settings.xlsx（「日记」工作表），导入缺失条目
npm run import:xlsx

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
| `npm run import:xlsx` | 从 `zhita_settings.xlsx` 导入日记 |
| `npm run build` | 打包到 `release/` 目录 |

## 数据目录

```
Echo/
├── entries/              # 日记 JSON（运行时生成，默认不提交到 Git）
│   └── 2026-01-01.json
├── 日记.txt              # 原始 txt 备份（可选，只读）
├── zhita_settings.xlsx   # Excel 历史日记（可选，启动时自动补全缺失条目）
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

应用只读写 `entries/`，不会修改 `日记.txt` 或 Excel 源文件。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+S` | 手动保存 |
| `Ctrl+K` | 聚焦搜索框 |
| `Ctrl+Shift+F` | 进入 / 退出专注模式 |
| `Alt+←` / `Alt+→` | 切换上 / 下一天 |
| `Esc` | 退出专注模式 / 关闭搜索 |
| `↑` / `↓` / `Enter` | 搜索时选择结果 |

## 项目结构

```
├── electron/           # Electron 主进程与 IPC
├── src/                # React 前端
│   ├── components/     # 界面组件
│   ├── lib/            # 工具函数
│   └── styles/         # 样式
├── scripts/            # 迁移与导入脚本
├── start.ps1           # Windows 启动脚本
└── package.json
```

## 许可证

个人项目，仅供学习与自用。
