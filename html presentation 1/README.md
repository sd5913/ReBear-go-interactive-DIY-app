# ReBear · 手机网页高保真交互原型 V3

以低保真原型及 [交互仓库](https://github.com/sd5913/ReBear-go-interactive-DIY-app) 为流程依据。参考代码版本：`7f7531722eb0524e24aef95231dd6aefd1c5e9c2`。

- Figma 文件：https://www.figma.com/design/1fr7orLNMHknqh5whxQals
- 最新 V3 可编辑画板：https://www.figma.com/design/1fr7orLNMHknqh5whxQals?node-id=18-2
- 最新 V3 可运行 Code Layer：https://www.figma.com/design/1fr7orLNMHknqh5whxQals?node-id=16-3&autoplay-code-preview=16-3
- 手机画板：390 × 844，共 12 个页面与状态。
- 美术：奶油条纹、暖黄与浅蓝、深棕抖动手绘线条；小熊及工坊由 AIGC 生成。当前提示词见 `assets/GENERATED-V2.md`。

## 本地运行

运行 `npm start`，打开 http://localhost:4173 。`design.html` 展示全部设计画板。

入口使用 `workflow.js`、`workflow.css` 以及基础 `style.css`、`polish.css`，无需安装前端依赖。

## 已实现流程

首页 → 布料列表 → 拍照或相册上传 → 框选可用布料并输入厘米尺寸 → 保存多个布料 → 按头部、身体、耳朵、手臂、腿部摆放裁片 → 查看裁剪清单与展开缝制指引。

支持 JPG/PNG（最多 10MB）、拖动和缩放框选、实际裁剪图片、编辑替换及确认删除布料、裁片拖入与移动、45 度旋转、重置部位、完成门槛、确认后自动进入下一部位。布料纹理随所选部位显示在小熊示意图中。进度使用浏览器 localStorage 保存。

## 验证与边界

`npm run check` 完成语法检查；`node workflow-check.js` 使用 Chrome CDP 检查核心流程，23 项通过。12 个画板均无内容裁切，结果见 `preview/workflow-verification.json`，总览见 `preview/v3-all-screens.png`。

当前是高保真交互原型：小熊为二维拼布示意，尚无真实 3D 模型与旋转。厘米尺寸会保留，但裁片未实现工程比例、碰撞或缝份校验。项目纸样图片及数量用于交互演示，不能直接打印裁剪。进度保存在本机，无账户或云同步；拍照需要浏览器和设备支持。

Code Layer 源码已导入 Figma；云端预览的启动与发布尚未经验证。本地运行已验证。

早期 V1/V2 设计与代码保留供对照；`app.js`、`app-v2-archive.js`、`figma-polish/` 等不是当前版本入口。
