"""
Label Printing Service
化学分析标签打印服务 - 样品标签系统
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import time
import os
import sys
import json
import subprocess
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
import qrcode

# 可选：通过环境变量指定本地 DTPWeb SDK 路径。
dtpweb_lib_path = os.environ.get('DTPWEB_LIB_PATH')
if dtpweb_lib_path:
    sys.path.insert(0, dtpweb_lib_path)
try:
    from dtpweb.api import DTPWeb
    dtpweb_api = DTPWeb()
    print("DTPWeb API 初始化成功")
except Exception as e:
    dtpweb_api = None
    print(f"DTPWeb API 初始化失败: {e}")

from config import WORKSHOPS, WORKSHOP_LIST, BATCH_DISPLAY, LABEL_CONFIG, SENDERS, RECORD_CONFIG, FONT_PATHS
from batch_manager import batch_manager

# 获取项目根目录（src的父目录）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
SENDERS_FILE = os.path.join(DATA_DIR, 'senders.json')

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
CORS(app)


# ============== 公共工具函数 ==============

def load_font(size: int, bold: bool = False):
    """
    加载中文字体

    Args:
        size: 字体大小（像素）
        bold: 是否使用粗体

    Returns:
        ImageFont 对象
    """
    # 优先使用粗体字体的路径
    bold_paths = [
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    ]

    paths = bold_paths if bold else FONT_PATHS

    for font_path in paths:
        try:
            return ImageFont.truetype(font_path, size)
        except (IOError, OSError):
            continue

    # 如果粗体失败，尝试普通字体
    if bold:
        for font_path in FONT_PATHS:
            try:
                return ImageFont.truetype(font_path, size)
            except (IOError, OSError):
                continue

    return ImageFont.load_default()


# ============== 送样人数据管理 ==============

def load_senders():
    """加载送样人配置"""
    if os.path.exists(SENDERS_FILE):
        try:
            with open(SENDERS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            app.logger.warning(f"加载送样人配置失败: {e}")
    # 如果文件不存在，初始化默认配置
    save_senders({"default": SENDERS})
    return {"default": SENDERS}

def save_senders(senders_data):
    """保存送样人配置"""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SENDERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(senders_data, f, ensure_ascii=False, indent=2)

# 加载送样人数据
senders_data = load_senders()

# 初始化打印API
printers = []
app.logger.info("使用 DTPWeb API")

# 预设样品选项 (Preset Sample Options)
PRESET_SAMPLES = [
    {"id": "sample_1", "name": "土壤样品", "code": "SOIL", "type": "环境"},
    {"id": "sample_2", "name": "水质样品", "code": "WATER", "type": "环境"},
    {"id": "sample_3", "name": "气体样品", "code": "GAS", "type": "环境"},
    {"id": "sample_4", "name": "固体废弃物", "code": "SOLID", "type": "废弃物"},
    {"id": "sample_5", "name": "液体废弃物", "code": "LIQUID", "type": "废弃物"},
]

# 预设分析项目 (Preset Analysis Items)
PRESET_ANALYSIS = [
    {"id": "ph", "name": "pH值测定"},
    {"id": "cod", "name": "COD化学需氧量"},
    {"id": "bod", "name": "BOD生化需氧量"},
    {"id": "heavy_metal", "name": "重金属含量"},
    {"id": "organic", "name": "有机物分析"},
]


def refresh_printers():
    """刷新打印机列表 - 使用 DTPWeb API"""
    global printers

    printers.clear()

    # 使用 DTPWeb API 检测打印机
    if dtpweb_api:
        try:
            devices = dtpweb_api.get_printers()
            if devices:
                for dev in devices:
                    printers.append({
                        'name': dev.get('name', 'Unknown'),
                        'printerName': dev.get('printerName', dev.get('name', 'Unknown')),
                        'deviceName': dev.get('deviceName', ''),
                        'isOnline': dev.get('isOnline', False),
                        'source': 'dtpweb',
                    })
                print(f"通过DTPWeb发现 {len(printers)} 台打印机")
                for printer in printers:
                    print(f"  - {printer.get('printerName', 'Unknown')}")
                return printers
        except Exception as e:
            print(f"DTPWeb检测失败: {e}")

    # 如果dtpweb失败，使用CUPS lpstat命令
    try:
        result = subprocess.run(['lpstat', '-p'],
                              capture_output=True,
                              text=True,
                              timeout=5)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if 'printer' in line.lower():
                    # 解析打印机名称
                    parts = line.split()
                    if len(parts) >= 2:
                        printer_name = parts[1]
                        # 构造打印机信息（与dtpweb格式兼容）
                        printer_info = {
                            'name': printer_name,
                            'deviceUri': f'cups:{printer_name}',
                            'location': '',
                            'model': 'CUPS Printer',
                            'source': 'cups',
                        }
                        printers.append(printer_info)

            if printers:
                print(f"通过CUPS发现 {len(printers)} 台打印机")
                for printer in printers:
                    print(f"  - {printer.get('name', 'Unknown')}")
                return printers
    except Exception as e:
        print(f"CUPS检测失败: {e}")

    print("未检测到打印机")
    return printers


@app.route('/')
def index():
    """主页 - 样品标签打印系统"""
    return render_template('index.html')


@app.route('/api/printers', methods=['GET'])
def get_printers():
    """获取打印机列表"""
    refresh_printers()
    return jsonify({
        'success': True,
        'printers': printers
    })


@app.route('/api/samples', methods=['GET'])
def get_samples():
    """获取预设样品列表"""
    return jsonify({
        'success': True,
        'samples': PRESET_SAMPLES
    })


@app.route('/api/analysis', methods=['GET'])
def get_analysis():
    """获取预设分析项目列表"""
    return jsonify({
        'success': True,
        'analysis': PRESET_ANALYSIS
    })


# ============== 系统管理 API ==============

@app.route('/api/system/restart', methods=['POST'])
def restart_system():
    """重启系统服务"""
    try:
        # 创建重启脚本并执行
        # 先返回响应，然后在后台执行重启
        import threading

        def do_restart():
            import time
            time.sleep(1)  # 等待响应发送完成
            # 重启 systemd 服务（这会重启 Flask 和浏览器）
            os.system('pkill -f chromium')  # 关闭浏览器
            time.sleep(0.5)
            os.system('sudo systemctl restart label-printer')  # 重启服务
            time.sleep(2)
            # 重新打开浏览器
            os.system('DISPLAY=:0 chromium --kiosk --noerrdialogs --disable-infobars --no-first-run http://127.0.0.1:5001 &')

        restart_thread = threading.Thread(target=do_restart)
        restart_thread.start()

        return jsonify({'success': True, 'message': '系统正在重启...'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ============== 样品标签系统 API ==============

@app.route('/api/workshops', methods=['GET'])
def get_workshops():
    """获取车间列表"""
    return jsonify({
        'success': True,
        'workshops': WORKSHOP_LIST
    })


@app.route('/api/senders', methods=['GET'])
def get_senders():
    """获取送样人列表"""
    workshop_id = request.args.get('workshop')
    global senders_data
    senders_data = load_senders()  # 重新加载确保最新

    # 如果指定了车间，返回车间专属+通用送样人
    workshop_senders = senders_data.get(workshop_id, []) if workshop_id != 'default' else []
    default_senders = senders_data.get('default', [])

    # 过滤：如果车间有同名的，不显示通用中的
    workshop_names = {s['name'] for s in workshop_senders}
    filtered_default = [s for s in default_senders if s['name'] not in workshop_names]

    return jsonify({
        'success': True,
        'workshop_senders': workshop_senders,  # 车间专属
        'default_senders': filtered_default,    # 通用
        'senders': workshop_senders + filtered_default,  # 合并列表（兼容旧逻辑）
    })


@app.route('/api/senders/all', methods=['GET'])
def get_all_senders():
    """获取所有车间的送样人配置"""
    global senders_data
    senders_data = load_senders()

    return jsonify({
        'success': True,
        'senders': senders_data
    })


@app.route('/api/senders/<workshop_id>', methods=['POST'])
def update_workshop_senders(workshop_id):
    """更新指定车间的送样人列表"""
    global senders_data

    data = request.get_json()
    if not data or 'senders' not in data:
        return jsonify({'success': False, 'error': '缺少送样人数据'})

    senders_data = load_senders()
    senders_data[workshop_id] = data['senders']
    save_senders(senders_data)

    return jsonify({
        'success': True,
        'message': f'车间 {workshop_id} 送样人已更新',
        'senders': senders_data[workshop_id]
    })


@app.route('/api/senders/<workshop_id>/add', methods=['POST'])
def add_sender(workshop_id):
    """添加送样人"""
    global senders_data

    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'success': False, 'error': '缺少送样人姓名'})

    name = data['name'].strip()
    if not name:
        return jsonify({'success': False, 'error': '送样人姓名不能为空'})

    senders_data = load_senders()

    # 确保车间配置存在
    if workshop_id not in senders_data:
        senders_data[workshop_id] = []

    # 检查是否已存在
    for sender in senders_data[workshop_id]:
        if sender['name'] == name:
            return jsonify({'success': False, 'error': '该送样人已存在'})

    # 生成ID
    sender_id = name.lower().replace(' ', '_')
    new_sender = {'id': sender_id, 'name': name}
    senders_data[workshop_id].append(new_sender)
    save_senders(senders_data)

    return jsonify({
        'success': True,
        'message': f'已添加送样人: {name}',
        'sender': new_sender,
        'senders': senders_data[workshop_id]
    })


@app.route('/api/senders/<workshop_id>/remove', methods=['POST'])
def remove_sender(workshop_id):
    """删除送样人"""
    global senders_data

    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'success': False, 'error': '缺少送样人姓名'})

    name = data['name']

    senders_data = load_senders()

    if workshop_id not in senders_data:
        return jsonify({'success': False, 'error': '车间不存在'})

    # 查找并删除
    original_len = len(senders_data[workshop_id])
    senders_data[workshop_id] = [s for s in senders_data[workshop_id] if s['name'] != name]

    if len(senders_data[workshop_id]) == original_len:
        return jsonify({'success': False, 'error': '未找到该送样人'})

    save_senders(senders_data)

    return jsonify({
        'success': True,
        'message': f'已删除送样人: {name}',
        'senders': senders_data[workshop_id]
    })


@app.route('/api/workshop/<workshop_id>/samples', methods=['GET'])
def get_workshop_samples(workshop_id):
    """获取指定车间的样品类型列表"""
    workshop = WORKSHOPS.get(workshop_id)
    if not workshop:
        return jsonify({'success': False, 'error': f'车间 {workshop_id} 不存在'})

    return jsonify({
        'success': True,
        'workshop': {
            'id': workshop['id'],
            'name': workshop['name']
        },
        'samples': workshop['samples']
    })


@app.route('/api/batches/<prefix>', methods=['GET'])
def get_batch_status(prefix):
    """获取指定样品类型的批号状态"""
    page = request.args.get('page', type=int)
    last_month = request.args.get('last_month', 'false').lower() == 'true'

    # 如果请求上月数据
    if last_month:
        result = batch_manager.get_last_month_final_batches(prefix)
        return jsonify({
            'success': True,
            **result
        })

    # 正常当前月数据
    if page is not None:
        # 获取指定页
        result = batch_manager.get_page_batches(prefix, page)
    else:
        # 获取推荐页（包含下一个可用批号的页）
        recommended_page = batch_manager.get_recommended_page(prefix)
        result = batch_manager.get_page_batches(prefix, recommended_page)

    return jsonify({
        'success': True,
        **result
    })


@app.route('/api/month-info', methods=['GET'])
def get_month_info():
    """获取当前月份信息"""
    result = batch_manager.get_current_month_info()
    return jsonify({
        'success': True,
        **result
    })


@app.route('/api/reset-month', methods=['POST'])
def reset_month():
    """重置当前月份的所有批号数据"""
    try:
        result = batch_manager.reset_current_month()
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


@app.route('/api/batches/<prefix>/<int:batch>/sub', methods=['GET'])
def get_sub_batch_status(prefix, batch):
    """获取分段样品子序号状态"""
    page = request.args.get('page', type=int)
    max_sub = request.args.get('max_sub', 20, type=int)

    if page is not None:
        result = batch_manager.get_page_sub_batches(prefix, batch, page, max_sub)
    else:
        # 自动跳转到包含推荐子序号的页面
        recommended_page = batch_manager.get_recommended_sub_page(prefix, batch)
        result = batch_manager.get_page_sub_batches(prefix, batch, recommended_page, max_sub)

    return jsonify({
        'success': True,
        **result
    })


@app.route('/api/print/sample', methods=['POST'])
def print_sample():
    """打印样品标签"""
    try:
        data = request.json

        # DEBUG: 记录收到的请求数据
        app.logger.warning(f"========== /api/print/sample 收到请求 ==========")
        app.logger.warning(f"请求数据: {data}")

        # 获取参数
        sample_id = data.get('sample_id')  # 样品类型ID
        sample_name = data.get('sample_name')  # 样品名称
        prefix = data.get('prefix')  # 批号前缀
        batch = data.get('batch')  # 批号
        sub = data.get('sub')  # 子序号（分段样品用）
        copies = data.get('copies', 1)  # 打印份数
        printer_name = data.get('printer')  # 打印机名称
        sender = data.get('sender', '')  # 送样人
        special_format = data.get('special_format', False)  # 是否使用特殊格式
        year_month = data.get('year_month')  # 年月（用于延续上月生产）

        app.logger.warning(f"解析参数: sample_name={sample_name}, prefix={prefix}, batch={batch}, sub={sub}, sender={sender}")

        if not all([sample_name, prefix, batch]):
            return jsonify({'success': False, 'error': '缺少必要参数'})

        # 确保批号和子序号是整数类型
        try:
            batch = int(batch)
            if sub is not None:
                sub = int(sub)
        except (ValueError, TypeError) as e:
            return jsonify({'success': False, 'error': f'批号格式错误: {e}'})

        # 验证并使用批号
        sub_suffix = data.get('sub_suffix', '')
        if sub is not None:
            success, msg = batch_manager.use_sub_batch(prefix, batch, sub)
            batch_id = batch_manager.format_batch_id(prefix, batch, sub, special_format, sub_suffix, year_month)
        else:
            success, msg = batch_manager.use_batch(prefix, batch)
            batch_id = batch_manager.format_batch_id(prefix, batch, special_format=special_format, year_month=year_month)

        if not success:
            return jsonify({'success': False, 'error': msg})

        is_reprint = (msg == "重新打印")

        # 如果没有打印机，刷新列表
        if not printers:
            refresh_printers()

        if not printers:
            return jsonify({'success': False, 'error': '未找到可用打印机'})

        # 选择打印机
        printer = None
        if printer_name:
            printer = next((p for p in printers if p.get('name') == printer_name), None)
        if not printer:
            printer = printers[0]

        app.logger.warning(f"选择的打印机: {printer}")

        # 生成并打印标签
        sample_info = {
            'sampleName': sample_name,
            'batchId': batch_id,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'isReprint': is_reprint,
            'sender': sender  # 送样人
        }

        app.logger.warning(f"sample_info: {sample_info}")

        # 打印指定份数
        for i in range(copies):
            app.logger.warning(f"开始打印第 {i+1}/{copies} 份")
            result = print_workshop_label(printer, sample_info)
            app.logger.warning(f"打印结果: {result}")
            if not result['success']:
                return jsonify(result)

        return jsonify({
            'success': True,
            'message': f'{"重新" if is_reprint else ""}打印成功',
            'batch_id': batch_id,
            'copies': copies,
            'printer': printer.get('name')
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


def print_workshop_label(printer, sample_info):
    """
    打印车间样品标签
    标签尺寸: 40mm x 15mm (横向)
    使用图片方式打印，支持中文
    """
    import io
    import base64
    import tempfile

    printer_name = printer.get('name')
    printer_source = printer.get('source', '')

    # 标签参数
    label_width_mm = LABEL_CONFIG['width_mm']  # 40mm
    label_height_mm = LABEL_CONFIG['height_mm']  # 15mm

    # 获取样品信息
    sample_name = sample_info.get('sampleName', '')
    batch_id = sample_info.get('batchId', '')
    timestamp = sample_info.get('timestamp', '')
    is_reprint = sample_info.get('isReprint', False)
    sender = sample_info.get('sender', '')  # 送样人

    # 格式化日期时间（MM-DD HH:MM）
    if ' ' in timestamp:
        date_part, time_part = timestamp.split(' ')
        month_day = '-'.join(date_part.split('-')[1:3])
        hour_min = ':'.join(time_part.split(':')[0:2])
        datetime_text = f"{month_day} {hour_min}"
    else:
        datetime_text = timestamp

    # 生成标签图像
    def create_label_image(dpi: int):
        """根据指定DPI创建标签图像"""
        width_px = int(label_width_mm * dpi / 25.4)
        height_px = int(label_height_mm * dpi / 25.4)
        left_margin = int(3 * dpi / 25.4)  # 3mm 左边距

        img = Image.new('RGB', (width_px, height_px), 'white')
        draw = ImageDraw.Draw(img)

        # 根据DPI缩放字体大小
        scale = dpi / 300  # 以300 DPI为基准
        name_font = load_font(int(42 * scale))
        batch_font = load_font(int(36 * scale))
        time_font = load_font(int(30 * scale))
        sender_font = load_font(int(48 * scale))
        reprint_font = load_font(int(24 * scale))

        # 缩放Y坐标
        y1, y2, y3 = int(8 * scale), int(58 * scale), int(105 * scale)

        # 绘制文本
        draw.text((left_margin, y1), sample_name, fill='black', font=name_font)
        draw.text((left_margin, y2), batch_id, fill='black', font=batch_font)
        draw.text((left_margin, y3), datetime_text, fill='black', font=time_font)

        # 送样人（右侧居中）
        if sender:
            sender_char_width = int(48 * scale)
            sender_x = width_px - left_margin - len(sender) * sender_char_width
            if sender_x < width_px // 2:
                sender_x = width_px // 2 + int(20 * scale)
            sender_y = (height_px - sender_char_width) // 2
            draw.text((sender_x, sender_y), sender, fill='black', font=sender_font)

        # 重打印标记
        if is_reprint:
            draw.text((width_px - int(40 * scale), int(5 * scale)), "R", fill='gray', font=reprint_font)

        return img

    # 优先使用 DTPWeb API 打印（300 DPI）
    if printer_source == 'dtpweb' and dtpweb_api:
        try:
            app.logger.warning(f"===== 开始 DTPWeb 打印 =====")
            app.logger.warning(f"printer_name: {printer_name}")
            app.logger.warning(f"sample_name: {sample_name}, batch_id: {batch_id}")

            img = create_label_image(dpi=300)
            app.logger.warning(f"图像创建成功, 尺寸: {img.size}")

            # 转换为base64
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='PNG')
            img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
            app.logger.warning(f"Base64 转换成功, 长度: {len(img_base64)}")

            # 必须先打开打印机
            app.logger.warning(f"尝试打开打印机: {printer_name}")
            open_result = dtpweb_api.open_printer(name=printer_name)
            app.logger.warning(f"open_printer 返回: {open_result}")

            if not open_result:
                return {'success': False, 'error': 'DTPWeb打印失败: 无法打开打印机'}

            try:
                # 根据 SDK 示例，print_image 只需传图片数据
                # 图片需要包含 data:image/png;base64, 前缀
                img_data_uri = f"data:image/png;base64,{img_base64}"
                app.logger.warning(f"调用 print_image, 数据长度: {len(img_data_uri)}")
                result = dtpweb_api.print_image(img_data_uri)

                app.logger.warning(f"DTPWeb print_image 返回: {result}, 类型: {type(result)}")

                if result is True:
                    app.logger.warning("打印成功!")
                    return {'success': True, 'message': '打印成功', 'printer': printer_name}
                else:
                    app.logger.warning(f"打印失败! result={result}")
                    return {'success': False, 'error': 'DTPWeb打印失败: 打印机返回False'}
            finally:
                # 确保关闭打印机
                dtpweb_api.close_printer()
                app.logger.warning("打印机已关闭")

        except Exception as e:
            app.logger.error(f"DTPWeb打印异常: {e}")
            import traceback
            app.logger.error(traceback.format_exc())
            return {'success': False, 'error': f'DTPWeb打印失败: {str(e)}'}

    # 备用：使用 CUPS lp 命令打印（72 DPI）
    tmp_path = None
    try:
        img = create_label_image(dpi=72)

        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img.save(tmp.name, 'PNG')
            tmp_path = tmp.name

        result = subprocess.run(
            [
                'lp', '-d', printer_name,
                '-o', f'PageSize=Custom.{label_width_mm}x{label_height_mm}mm',
                '-o', f'media=Custom.{label_width_mm}x{label_height_mm}mm',
                '-o', 'page-left=0', '-o', 'page-right=0',
                '-o', 'page-top=0', '-o', 'page-bottom=0',
                '-o', 'scaling=100', '-o', 'fit-to-page',
                '-o', 'orientation-requested=3',
                tmp_path
            ],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            return {'success': True, 'message': '打印成功', 'printer': printer_name}
        else:
            return {'success': False, 'error': f'打印失败: {result.stderr}'}

    except subprocess.TimeoutExpired:
        return {'success': False, 'error': '打印超时'}
    except Exception as e:
        return {'success': False, 'error': f'打印失败: {str(e)}'}
    finally:
        # 清理临时文件
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# ============== 原有API保持兼容 ==============


@app.route('/api/print', methods=['POST'])
def print_label():
    """打印标签"""
    try:
        data = request.json
        printer_name = data.get('printer')
        sample_info = data.get('sample')

        if not sample_info:
            return jsonify({'success': False, 'error': '缺少样品信息'})

        # 如果没有打印机，刷新列表
        if not printers:
            refresh_printers()

        if not printers:
            return jsonify({'success': False, 'error': '未找到可用打印机'})

        # 选择打印机
        printer = None
        if printer_name:
            printer = next((p for p in printers if p.get('name') == printer_name), None)
        if not printer:
            printer = printers[0]

        # 打印标签
        result = print_sample_label(printer, sample_info)

        return jsonify(result)

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


def print_sample_label(printer, sample_info):
    """
    生成并打印样品标签
    标签尺寸: 40mm x 60mm (纸张), 但横向布局内容
    """
    label_width = 40
    label_height = 60

    printer_name = printer.get('name')

    # 使用CUPS打印机
    if printer.get('deviceUri', '').startswith('cups:') or printer.get('source') == 'cups':
        return print_label_via_cups(printer_name, sample_info, label_width, label_height)

    # 使用原生LPAPI
    if printer.get('source') == 'native':
        if not native_api:
            return {'success': False, 'error': '本地LPAPI不可用'}
        device = PrinterDevice(
            name=printer.get('name', ''),
            address=printer.get('address', ''),
            address_type=printer.get('addressType', 0),
        )
        try:
            native_api.print_sample_label(device, sample_info, label_width=label_width, label_height=label_height)
            return {
                'success': True,
                'message': '打印成功',
                'printer': printer.get('name'),
                'sample_id': sample_info.get('sampleId', 'N/A')
            }
        except Exception as exc:
            return {'success': False, 'error': f'打印失败: {exc}'}

    return {'success': False, 'error': '不支持的打印机类型'}


def print_label_via_cups(printer_name, sample_info, label_width, label_height):
    """
    使用CUPS直接打印标签（当dtpweb helper不可用时）
    标签尺寸: 40mm x 60mm (竖向)
    """
    import subprocess
    import tempfile
    from PIL import Image, ImageDraw, ImageFont
    import qrcode

    try:
        # 创建标签图片 - 竖向布局
        # Use predefined C35X70 page size (35mm × 70mm) - closest to 40x60mm
        # CUPS always treats images as 72 DPI (screen resolution)
        # 35mm = 1.378 inches × 72 DPI = 99 pixels
        # 70mm = 2.756 inches × 72 DPI = 198 pixels
        width_px = 99    # 35mm at 72 DPI (matches C35X70 predefined size)
        height_px = 198  # 70mm at 72 DPI (matches C35X70 predefined size)

        # 创建白色背景图片 (竖向)
        img = Image.new('RGB', (width_px, height_px), 'white')
        draw = ImageDraw.Draw(img)

        # 加载中文字体 - scaled down for 72 DPI image
        title_font = load_font(10, bold=True)
        text_font = load_font(8, bold=True)
        label_font = load_font(6)
        date_font = load_font(5)

        # 获取样品信息
        sample_id = sample_info.get('sampleId', 'N/A')
        sample_type = sample_info.get('sampleType', 'N/A')
        analysis = sample_info.get('analysis', 'N/A')
        date_str = datetime.now().strftime('%Y-%m-%d %H:%M')

        # 边距设置 - scaled down for smaller image
        margin = 2

        # 1. 绘制外边框
        draw.rectangle([margin, margin, width_px-margin-1, height_px-margin-1],
                      outline='black', width=2)

        # 竖向布局: 顶部标题 | 中间信息 | 底部二维码

        # 2. 顶部标题区域 (约1/4高度)
        title_height = int(height_px * 0.25)
        y_pos = margin + 4

        # 标题居中
        title_text = "化学分析"
        title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_x = (width_px - title_width) // 2
        draw.text((title_x, y_pos), title_text, fill='black', font=title_font)

        # 3. 中间信息区域
        y_pos = margin + title_height
        info_x = margin + 2
        line_spacing = 11  # Scaled down from 45

        # 样品编号
        draw.text((info_x, y_pos), f"编号: {sample_id[:12]}", fill='black', font=label_font)
        y_pos += line_spacing

        # 样品类型
        draw.text((info_x, y_pos), f"类型: {sample_type[:8]}", fill='black', font=label_font)
        y_pos += line_spacing

        # 分析项目
        draw.text((info_x, y_pos), f"分析: {analysis[:8]}", fill='black', font=label_font)
        y_pos += line_spacing

        # 4. 底部二维码和日期
        qr_data = f"ID:{sample_id}|TYPE:{sample_type}|ANALYSIS:{analysis}|DATE:{date_str}"
        qr = qrcode.QRCode(version=1, box_size=3, border=1)
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")

        # QR码大小和位置（右下角） - scaled down
        qr_size = 25  # Scaled down from 100
        qr_img = qr_img.resize((qr_size, qr_size))
        qr_x = width_px - qr_size - margin - 1
        qr_y = height_px - qr_size - margin - 1
        img.paste(qr_img, (qr_x, qr_y))

        # 日期文字（左下角）
        date_y = height_px - margin - 8  # Scaled down from 30
        draw.text((info_x, date_y), date_str, fill='black', font=date_font)

        # 保存为临时文件
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img.save(tmp.name, 'PNG')
            tmp_path = tmp.name

        # 使用lp命令打印
        # 图像: 432×709px (竖向, 300 DPI) - matches printer's physical width
        # Printer max width: 432 dots = 36.58mm at 300 DPI
        result = subprocess.run(
            [
                'lp', '-d', printer_name,
                '-o', 'PageSize=Custom.37x60mm',  # Use printer's actual printable width
                '-o', 'media=Custom.37x60mm',
                '-o', 'page-left=0',
                '-o', 'page-right=0',
                '-o', 'page-top=0',
                '-o', 'page-bottom=0',
                '-o', 'scaling=100',
                '-o', 'fit-to-page',
                '-o', 'orientation-requested=3',  # portrait (竖向)
                tmp_path
            ],
            capture_output=True,
            text=True,
            timeout=10
        )

        # 清理临时文件
        import os
        os.unlink(tmp_path)

        if result.returncode == 0:
            return {
                'success': True,
                'message': '打印成功 (CUPS)',
                'printer': printer_name,
                'sample_id': sample_id
            }
        else:
            return {
                'success': False,
                'error': f'打印失败: {result.stderr}'
            }

    except Exception as e:
        return {'success': False, 'error': f'生成标签失败: {str(e)}'}


@app.route('/api/print-json', methods=['POST'])
def print_json_template():
    """
    使用JSON模板打印标签
    POST body: {
        "printer": "printer_name",
        "template": { ... JSON template object ... },
        "data": { ... optional data to fill in ... }
    }
    """
    try:
        data = request.get_json()
        printer_name = data.get('printer')
        template = data.get('template')
        dynamic_data = data.get('data', {})

        if not printer_name or not template:
            return jsonify({'success': False, 'error': '缺少打印机或模板参数'})

        # 提取模板信息
        label_width = template.get('labelWidth', 40)
        label_height = template.get('labelHeight', 60)

        # 转换尺寸为像素 (72 DPI - CUPS default, not printer's 300 DPI)
        # CUPS always interprets images at 72 DPI regardless of metadata
        dpi = 72
        pixels_per_mm = dpi / 25.4
        width_px = int(label_width * pixels_per_mm)
        height_px = int(label_height * pixels_per_mm)

        # 创建图像 (白底)
        img = Image.new('RGB', (width_px, height_px), 'white')
        draw = ImageDraw.Draw(img)

        # 处理模板中的每个元素
        for item in template.get('Page', []):
            if not item.get('printing', True):
                continue

            layer_class = item.get('layerClass')

            if layer_class == 'Text':
                content = item.get('content', '')

                # 应用动态数据替换
                for key, value in dynamic_data.items():
                    content = content.replace(key, str(value))

                # 转换坐标和尺寸为像素
                x = int(item.get('x', 0) * pixels_per_mm)
                y = int(item.get('y', 0) * pixels_per_mm)
                font_height_mm = item.get('fontHeight', 3)
                font_size = int(font_height_mm * pixels_per_mm)

                # 加载字体
                font = load_font(font_size)

                # 绘制文本
                draw.text((x, y), content, fill='black', font=font)

            elif layer_class == 'Qrcode':
                content = item.get('content', 'QR_DATA')

                # 应用动态数据
                for key, value in dynamic_data.items():
                    content = content.replace(key, str(value))

                # 如果内容为空,使用默认值
                if not content or content == 'QR_DATA':
                    content = f"Template:{template.get('labelName', 'Label')}"

                # 生成二维码
                qr = qrcode.QRCode(version=1, box_size=3, border=0)
                qr.add_data(content)
                qr.make(fit=True)
                qr_img = qr.make_image(fill_color="black", back_color="white")

                # 转换坐标和尺寸
                x = int(item.get('x', 0) * pixels_per_mm)
                y = int(item.get('y', 0) * pixels_per_mm)
                qr_width = int(item.get('width', 10) * pixels_per_mm)
                qr_height = int(item.get('height', 10) * pixels_per_mm)

                # 调整二维码大小并粘贴
                qr_img = qr_img.resize((qr_width, qr_height))
                img.paste(qr_img, (x, y))

            elif layer_class == 'Line':
                # 转换坐标为像素
                x1 = int(item.get('x1', 0) * pixels_per_mm)
                y1 = int(item.get('y1', 0) * pixels_per_mm)
                x2 = int(item.get('x2', 10) * pixels_per_mm)
                y2 = int(item.get('y2', 10) * pixels_per_mm)

                # 绘制线条
                draw.line([(x1, y1), (x2, y2)], fill='black', width=2)

        # 保存为临时文件
        temp_file = f"/tmp/template_label_{int(time.time())}.png"
        img.save(temp_file, 'PNG')

        # 使用CUPS打印 (使用与化学标签相同的参数)
        result = subprocess.run([
            'lp',
            '-d', printer_name,
            '-o', 'PageSize=Custom.37x60mm',  # Match printer's actual printable width
            '-o', 'media=Custom.37x60mm',
            '-o', 'page-left=0',
            '-o', 'page-right=0',
            '-o', 'page-top=0',
            '-o', 'page-bottom=0',
            '-o', 'scaling=100',
            '-o', 'fit-to-page',
            '-o', 'orientation-requested=3',
            temp_file
        ], capture_output=True, text=True)

        # 清理临时文件
        try:
            os.remove(temp_file)
        except:
            pass

        # 检查打印命令是否成功
        if result.returncode != 0:
            raise Exception(f"打印命令失败: {result.stderr}")

        return jsonify({
            'success': True,
            'message': f'模板 "{template.get("labelName", "未命名")}" 打印成功',
            'template_name': template.get('labelName'),
            'elements': len(template.get('Page', []))
        })

    except subprocess.CalledProcessError as e:
        return jsonify({'success': False, 'error': f'打印失败: {str(e)}'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ============== 送样记录查看功能 ==============

@app.route('/api/records/months', methods=['GET'])
def get_record_months():
    """获取有记录的月份列表"""
    try:
        records_dir = os.path.join(BASE_DIR, RECORD_CONFIG.get('save_path', 'records'))

        if not os.path.exists(records_dir):
            return jsonify({'success': True, 'months': []})

        months = []
        for item in os.listdir(records_dir):
            item_path = os.path.join(records_dir, item)
            if os.path.isdir(item_path) and len(item) == 6 and item.isdigit():
                # 格式化月份显示 如 202511 -> 2025年11月
                year = item[:4]
                month = item[4:]
                months.append({
                    'value': item,
                    'label': f'{year}年{int(month)}月'
                })

        # 按时间倒序排列
        months.sort(key=lambda x: x['value'], reverse=True)

        return jsonify({'success': True, 'months': months})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/records/<month>', methods=['GET'])
def get_records_by_month(month):
    """获取指定月份的记录列表"""
    try:
        records_dir = os.path.join(BASE_DIR, RECORD_CONFIG.get('save_path', 'records'), month)

        if not os.path.exists(records_dir):
            return jsonify({'success': True, 'records': []})

        records = []
        for filename in os.listdir(records_dir):
            if filename.endswith('.html'):
                file_path = os.path.join(records_dir, filename)
                # 从文件名解析信息，格式: 批号_时间戳.html
                parts = filename.replace('.html', '').split('_')
                if len(parts) >= 3:
                    batch_id = parts[0]
                    date_str = parts[1]
                    time_str = parts[2]
                    # 格式化时间显示
                    try:
                        formatted_time = f'{date_str[:4]}-{date_str[4:6]}-{date_str[6:]} {time_str[:2]}:{time_str[2:4]}:{time_str[4:]}'
                    except:
                        formatted_time = filename
                else:
                    batch_id = filename.replace('.html', '')
                    formatted_time = ''

                records.append({
                    'filename': filename,
                    'batch_id': batch_id,
                    'time': formatted_time,
                    'month': month
                })

        # 按时间倒序排列
        records.sort(key=lambda x: x['filename'], reverse=True)

        return jsonify({'success': True, 'records': records})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/records/<month>/<filename>', methods=['GET'])
def get_record_content(month, filename):
    """获取指定记录的HTML内容"""
    try:
        file_path = os.path.join(BASE_DIR, RECORD_CONFIG.get('save_path', 'records'), month, filename)

        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': '记录文件不存在'})

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return content, 200, {'Content-Type': 'text/html; charset=utf-8'}

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ============== 送样记录保存功能 ==============

def save_sample_record(record_data):
    """
    保存样品送检记录为HTML文件

    Args:
        record_data: 包含以下字段的字典
            - workshop: 车间名称
            - sample_name: 样品名称
            - batch_id: 批号
            - sample_time: 取样时间
            - sender: 送样人
            - signature: Base64格式的签名图片
            - copies: 打印份数
            - is_reprint: 是否重打印

    Returns:
        dict: {'success': True/False, 'file_path': '...', 'error': '...'}
    """
    import base64

    try:
        # 获取年月
        now = datetime.now()
        year_month = now.strftime('%Y%m')

        # 创建记录目录
        record_dir = os.path.join(BASE_DIR, RECORD_CONFIG.get('save_path', 'records'), year_month)
        os.makedirs(record_dir, exist_ok=True)

        # 生成文件名
        timestamp = now.strftime('%Y%m%d_%H%M%S')
        batch_id = record_data.get('batch_id', 'unknown')
        filename = f"{batch_id}_{timestamp}.html"
        file_path = os.path.join(record_dir, filename)

        # 生成HTML内容
        html_content = generate_record_html(record_data)

        # 保存文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return {
            'success': True,
            'file_path': file_path,
            'filename': filename
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def generate_record_html(record_data):
    """生成样品送检记录的HTML内容"""

    record_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>样品送检记录 - {record_data.get('batch_id', '')}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: "Microsoft YaHei", "SimHei", sans-serif;
            background: #f5f5f5;
            padding: 40px;
            padding-top: 80px;
        }}
        .close-btn {{
            position: fixed;
            top: 15px;
            right: 15px;
            background: linear-gradient(145deg, #f44336 0%, #c62828 100%);
            color: #fff;
            border: none;
            padding: 15px 30px;
            font-size: 20px;
            border-radius: 10px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 1000;
        }}
        .close-btn:hover {{
            background: linear-gradient(145deg, #ef5350 0%, #f44336 100%);
        }}
        .close-btn:active {{
            transform: scale(0.95);
        }}
        .record-container {{
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .record-header {{
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            color: #fff;
            padding: 30px;
            text-align: center;
        }}
        .record-header h1 {{
            font-size: 28px;
            margin-bottom: 10px;
        }}
        .record-header .subtitle {{
            font-size: 16px;
            opacity: 0.8;
        }}
        .record-body {{
            padding: 40px;
        }}
        .info-table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }}
        .info-table th,
        .info-table td {{
            padding: 15px 20px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }}
        .info-table th {{
            width: 120px;
            color: #666;
            font-weight: normal;
        }}
        .info-table td {{
            font-size: 18px;
            font-weight: 600;
            color: #333;
        }}
        .info-table tr:last-child th,
        .info-table tr:last-child td {{
            border-bottom: none;
        }}
        .batch-id {{
            color: #1565c0;
            font-size: 24px !important;
        }}
        .reprint-tag {{
            display: inline-block;
            background: #ff9800;
            color: #fff;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            margin-left: 10px;
        }}
        .signature-section {{
            margin-top: 30px;
            padding-top: 30px;
            border-top: 2px solid #eee;
        }}
        .signature-title {{
            font-size: 16px;
            color: #666;
            margin-bottom: 15px;
        }}
        .signature-image {{
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 10px;
            background: #fff;
            display: inline-block;
        }}
        .signature-image img {{
            max-width: 400px;
            max-height: 150px;
        }}
        .record-footer {{
            background: #f9f9f9;
            padding: 20px 40px;
            text-align: center;
            color: #999;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <button class="close-btn" onclick="closeRecord()">✕ 关闭</button>
    <div class="record-container">
        <div class="record-header">
            <h1>样品送检记录</h1>
            <div class="subtitle">Sample Submission Record</div>
        </div>
        <div class="record-body">
            <table class="info-table">
                <tr>
                    <th>车间</th>
                    <td>{record_data.get('workshop', '-')}</td>
                </tr>
                <tr>
                    <th>样品名称</th>
                    <td>{record_data.get('sample_name', '-')}</td>
                </tr>
                <tr>
                    <th>批号</th>
                    <td class="batch-id">
                        {record_data.get('batch_id', '-')}
                        {'<span class="reprint-tag">重新打印</span>' if record_data.get('is_reprint') else ''}
                    </td>
                </tr>
                <tr>
                    <th>取样时间</th>
                    <td>{record_data.get('sample_time', '-')}</td>
                </tr>
                <tr>
                    <th>送样人</th>
                    <td>{record_data.get('sender', '-')}</td>
                </tr>
                <tr>
                    <th>打印份数</th>
                    <td>{record_data.get('copies', 1)} 份</td>
                </tr>
            </table>

            <div class="signature-section">
                <div class="signature-title">送样人签名</div>
                <div class="signature-image">
                    <img src="{record_data.get('signature', '')}" alt="签名">
                </div>
            </div>
        </div>
        <div class="record-footer">
            记录生成时间: {record_time}
        </div>
    </div>
    <script>
        function closeRecord() {{
            // 尝试关闭 iframe（在 iframe 中查看时）
            if (window.parent && window.parent !== window) {{
                window.parent.postMessage('closeRecord', '*');
            }}
            // 尝试关闭窗口（独立窗口查看时）
            window.close();
            // 如果无法关闭，返回上一页
            history.back();
        }}
    </script>
</body>
</html>'''

    return html


@app.route('/api/save-record', methods=['POST'])
def api_save_record():
    """保存样品送检记录"""
    try:
        data = request.json

        if not data:
            return jsonify({'success': False, 'error': '缺少数据'})

        result = save_sample_record(data)
        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


if __name__ == '__main__':
    print("=" * 50)
    print("化学分析标签打印服务启动中...")
    print("Label Printing Service Starting...")
    print("=" * 50)

    # 初始化时刷新打印机列表
    refresh_printers()

    # 启动Flask服务
    host = os.environ.get('LABEL_PRINTER_HOST', '0.0.0.0')
    port = int(os.environ.get('LABEL_PRINTER_PORT', '5001'))
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    app.run(host=host, port=port, debug=debug)
