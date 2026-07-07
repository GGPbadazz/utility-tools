# P&ID Pipe Label Utilities

这是一个已脱敏的 P&ID 管道标签与 DXF 辅助处理工具包，可作为公开 Git 仓库的起点。

## 内容

- `pipe_label_tool.html`：浏览器内运行的管道标签排版与打印工具。
- `label_template.sample.csv`：脱敏后的标签数据模板。
- `xlsx.full.min.js`：用于浏览器读取和生成 Excel 模板的 SheetJS 组件。
- `extract_pid_devices.py`：从 DXF 中提取设备、管线和管道标签。
- `pipe_connectivity.py`：基于 DXF 线段关系推断管道标签的可能起点和终点设备。
- `requirements.txt`：Python 脚本依赖。

## 使用标签工具

直接用浏览器打开 `pipe_label_tool.html`。工具支持：

- 载入 CSV / XLSX 标签表。
- 下载 CSV / XLSX 模板。
- 按 A4 页面预览、打印或导出 PDF。
- 调整每页张数、尺寸分组、序号和裁切线显示。

CSV 字段见 `label_template.sample.csv`。内置示例为通用虚构数据，不包含真实项目设备号或工艺信息。

## 使用 DXF 脚本

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python3 extract_pid_devices.py /path/to/your_pid.dxf --out-dir output
python3 pipe_connectivity.py /path/to/your_pid.dxf -o output/pid_pipe_connectivity.csv
```

DXF 文件通常包含项目图纸和客户信息，默认已被 `.gitignore` 排除。请只在本地处理，不要提交真实图纸或导出的真实数据。

## 脱敏说明

这个目录没有包含原始项目中的以下内容：

- 真实 DXF / DWG 图纸。
- 真实管道清单、设备号批量数据和脚本导出 CSV。
- Word 技术方案、Excel 原始表、drawio 草图、zip 发布包。
- `.venv`、`.DS_Store`、临时备份文件和本地历史文件。
- 带公司名、项目名或特定物料名的文件名。

上传前建议再运行一次：

```bash
git status
rg -n "客户|公司|项目|密码|secret|token|api_key|BEGIN RSA|BEGIN OPENSSH|真实项目关键词"
```

## Git 发布

首次发布可参考：

```bash
git commit -m "Initial sanitized release"
git remote add origin <your-repo-url>
git push -u origin main
```

正式公开前请补充适合你的开源许可证。
