const express = require('express');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const db = require('../database');

// 生成报告统计数据
const generateReportData = async (startDate, endDate, reportType) => {
  return new Promise((resolve, reject) => {
    // 将日期转换为完整的日期时间范围
    const startDateTime = startDate + ' 00:00:00';
    const endDateTime = endDate + ' 23:59:59';
    
    const queries = [
      // 总申请数
      `SELECT COUNT(*) as total FROM applications WHERE created_at BETWEEN ? AND ?`,
      // 已完成申请数
      `SELECT COUNT(*) as completed FROM applications WHERE status = 'completed' AND created_at BETWEEN ? AND ?`,
      // 待处理申请数
      `SELECT COUNT(*) as pending FROM applications WHERE status IN ('pending', 'processing') AND created_at BETWEEN ? AND ?`,
      // 紧急申请数
      `SELECT COUNT(*) as urgent FROM applications WHERE urgency = 'urgent' AND created_at BETWEEN ? AND ?`,
      // 按部门分组统计
      `SELECT department, COUNT(*) as count FROM applications WHERE created_at BETWEEN ? AND ? GROUP BY department ORDER BY count DESC`,
      // 按分析类型分组统计 - 处理JSON格式或直接字符串
      `SELECT 
        CASE 
          WHEN analysis_type IS NULL OR analysis_type = '' THEN '未指定'
          ELSE analysis_type 
        END as analysis_type, 
        COUNT(*) as count 
       FROM applications 
       WHERE created_at BETWEEN ? AND ? 
       GROUP BY analysis_type 
       ORDER BY count DESC`,
      // 按状态分组统计
      `SELECT status, COUNT(*) as count FROM applications WHERE created_at BETWEEN ? AND ? GROUP BY status ORDER BY count DESC`,
      // 按紧急程度分组统计
      `SELECT urgency, COUNT(*) as count FROM applications WHERE created_at BETWEEN ? AND ? GROUP BY urgency ORDER BY count DESC`,
      // 按项目分组统计 - 由于没有production_stage_id字段，使用project字段
      `SELECT 
        CASE 
          WHEN project IS NULL OR project = '' THEN '未指定项目'
          ELSE project 
        END as production_stage, 
        COUNT(*) as count 
       FROM applications 
       WHERE created_at BETWEEN ? AND ? 
       GROUP BY CASE 
          WHEN project IS NULL OR project = '' THEN '未指定项目'
          ELSE project 
        END
       ORDER BY count DESC`,
      // 按部门分组统计 - 重复统计（作为产线统计的替代）
      `SELECT 
        CASE 
          WHEN department IS NULL OR department = '' THEN '未指定部门'
          ELSE department 
        END as production_line, 
        COUNT(*) as count 
       FROM applications 
       WHERE created_at BETWEEN ? AND ? 
       GROUP BY CASE 
          WHEN department IS NULL OR department = '' THEN '未指定部门'
          ELSE department 
        END
       ORDER BY count DESC`
    ];

    const results = {
      total: 0,
      completed: 0,
      pending: 0,
      urgent: 0,
      departmentBreakdown: [],
      analysisTypeBreakdown: [],
      statusBreakdown: [],
      urgencyBreakdown: [],
      productionStageBreakdown: [],
      productionLineBreakdown: []
    };
    let completed = 0;

    queries.forEach((query, index) => {
      db.all(query, [startDateTime, endDateTime], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        switch (index) {
          case 0:
            results.total = rows[0]?.total || 0;
            break;
          case 1:
            results.completed = rows[0]?.completed || 0;
            break;
          case 2:
            results.pending = rows[0]?.pending || 0;
            break;
          case 3:
            results.urgent = rows[0]?.urgent || 0;
            break;
          case 4:
            results.departmentBreakdown = rows || [];
            break;
          case 5:
            results.analysisTypeBreakdown = rows || [];
            break;
          case 6:
            results.statusBreakdown = rows || [];
            break;
          case 7:
            results.urgencyBreakdown = rows || [];
            break;
          case 8:
            results.productionStageBreakdown = rows || [];
            break;
          case 9:
            results.productionLineBreakdown = rows || [];
            break;
        }

        completed++;
        if (completed === queries.length) {
          resolve(results);
        }
      });
    });
  });
};

// 生成Excel报告
const generateExcelReport = async (data, reportType, startDate, endDate) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('报告数据');

  // 设置标题
  worksheet.mergeCells('A1:D1');
  worksheet.getCell('A1').value = `${reportType === 'weekly' ? '周' : reportType === 'monthly' ? '月' : '年'}报告 (${startDate} 至 ${endDate})`;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  let currentRow = 3;

  // 添加统计数据
  worksheet.addRow(['统计总览', '']);
  worksheet.addRow(['指标', '数值']);
  worksheet.addRow(['总申请数', data.total]);
  worksheet.addRow(['已完成', data.completed]);
  worksheet.addRow(['待处理', data.pending]);
  worksheet.addRow(['紧急申请', data.urgent]);
  currentRow = 9;

  // 添加部门统计
  worksheet.addRow([]);
  worksheet.addRow(['部门统计']);
  worksheet.addRow(['部门', '申请数', '百分比']);
  data.departmentBreakdown.forEach(dept => {
    const percentage = data.total > 0 ? ((dept.count / data.total) * 100).toFixed(1) + '%' : '0%';
    worksheet.addRow([dept.department, dept.count, percentage]);
  });
  currentRow += 3 + data.departmentBreakdown.length;

  // 添加分析类型统计
  worksheet.addRow([]);
  worksheet.addRow(['分析类型统计']);
  worksheet.addRow(['分析类型', '申请数', '百分比']);
  data.analysisTypeBreakdown.forEach(type => {
    const percentage = data.total > 0 ? ((type.count / data.total) * 100).toFixed(1) + '%' : '0%';
    worksheet.addRow([type.analysis_type, type.count, percentage]);
  });
  currentRow += 3 + data.analysisTypeBreakdown.length;

  // 添加状态统计
  worksheet.addRow([]);
  worksheet.addRow(['状态统计']);
  worksheet.addRow(['状态', '申请数', '百分比']);
  data.statusBreakdown.forEach(status => {
    const percentage = data.total > 0 ? ((status.count / data.total) * 100).toFixed(1) + '%' : '0%';
    const statusName = status.status === 'pending' ? '待处理' : 
                      status.status === 'processing' ? '处理中' :
                      status.status === 'completed' ? '已完成' :
                      status.status === 'cancelled' ? '已取消' : status.status;
    worksheet.addRow([statusName, status.count, percentage]);
  });
  currentRow += 3 + data.statusBreakdown.length;

  // 添加生产环节统计
  worksheet.addRow([]);
  worksheet.addRow(['生产环节统计']);
  worksheet.addRow(['生产环节', '申请数', '百分比']);
  data.productionStageBreakdown.forEach(stage => {
    const percentage = data.total > 0 ? ((stage.count / data.total) * 100).toFixed(1) + '%' : '0%';
    worksheet.addRow([stage.production_stage, stage.count, percentage]);
  });
  currentRow += 3 + data.productionStageBreakdown.length;

  // 添加产线统计
  worksheet.addRow([]);
  worksheet.addRow(['产线统计']);
  worksheet.addRow(['产线', '申请数', '百分比']);
  data.productionLineBreakdown.forEach(line => {
    const percentage = data.total > 0 ? ((line.count / data.total) * 100).toFixed(1) + '%' : '0%';
    worksheet.addRow([line.production_line, line.count, percentage]);
  });

  // 添加紧急程度统计
  worksheet.addRow([]);
  worksheet.addRow(['紧急程度统计']);
  worksheet.addRow(['紧急程度', '申请数', '百分比']);
  data.urgencyBreakdown.forEach(urgency => {
    const percentage = data.total > 0 ? ((urgency.count / data.total) * 100).toFixed(1) + '%' : '0%';
    const urgencyName = urgency.urgency === 'normal' ? '正常' : 
                       urgency.urgency === 'urgent' ? '紧急' :
                       urgency.urgency === 'high' ? '高' : urgency.urgency;
    worksheet.addRow([urgencyName, urgency.count, percentage]);
  });

  // 设置列宽
  worksheet.columns = [
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 15 }
  ];

  // 设置样式
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      
      if (rowNumber === 1) {
        cell.font = { bold: true, size: 16 };
        cell.alignment = { horizontal: 'center' };
      } else if (cell.value && typeof cell.value === 'string' && 
                 (cell.value.includes('统计') || cell.value.includes('总览'))) {
        cell.font = { bold: true, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
      }
    });
  });

  return await workbook.xlsx.writeBuffer();
};

// 生成HTML报告
const generateHtmlReport = (data, reportType, startDate, endDate) => {
  const getStatusColor = (status) => {
    const colors = {
      'pending': '#E6A23C',
      'processing': '#409EFF', 
      'completed': '#67C23A',
      'cancelled': '#F56C6C'
    };
    return colors[status] || '#909399';
  };

  // 为不同数据类型生成不同的颜色
  const getRandomColor = (key) => {
    const colors = [
      '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399',
      '#36CFC9', '#722ED1', '#EB2F96', '#FA8C16', '#52C41A',
      '#1890FF', '#F759AB', '#13C2C2', '#FA541C', '#A0D911'
    ];
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const formatStatus = (status) => {
    const statusMap = {
      'pending': '待处理',
      'processing': '处理中',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  };

  const formatUrgency = (urgency) => {
    const urgencyMap = {
      'normal': '正常',
      'urgent': '紧急',
      'high': '高'
    };
    return urgencyMap[urgency] || urgency;
  };

  const generateChartSection = (title, breakdown, total, formatter = null) => {
    if (!breakdown || breakdown.length === 0) return '';
    
    const items = breakdown.map(item => {
      const key = Object.keys(item)[0];
      const value = item[key];
      const count = item.count;
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      const displayValue = formatter ? formatter(value) : value;
      
      // 根据不同的图表类型选择颜色
      const color = title.includes('状态') ? getStatusColor(value) : getRandomColor(value);
      
      return `
        <div class="chart-item">
          <div class="chart-bar">
            <div class="bar-fill" style="width: ${percentage}%; background-color: ${color};"></div>
          </div>
          <div class="chart-label">${displayValue}: ${count} (${percentage}%)</div>
        </div>
      `;
    }).join('');

    return `
      <div class="chart-section">
        <h3>${title}</h3>
        <div class="chart-items">
          ${items}
        </div>
      </div>
    `;
  };

  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${reportType === 'weekly' ? '周' : reportType === 'monthly' ? '月' : '年'}报告</title>
      <style>
        @page {
          size: A4;
          margin: 20mm;
        }
        
        body {
          font-family: 'Microsoft YaHei', Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
          color: #333;
          line-height: 1.6;
        }
        
        .report-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #409EFF;
          padding-bottom: 20px;
        }
        
        .report-title {
          font-size: 24px;
          font-weight: bold;
          color: #303133;
          margin-bottom: 10px;
        }
        
        .report-subtitle {
          font-size: 14px;
          color: #606266;
        }
        
        .overview-stats {
          display: flex;
          justify-content: space-around;
          margin-bottom: 30px;
          background: #f8f9fa !important;
          padding: 20px;
          border-radius: 8px;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .stat-item {
          text-align: center;
        }
        
        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #409EFF !important;
          margin-bottom: 5px;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .stat-label {
          font-size: 14px;
          color: #606266;
        }
        
        .charts-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-top: 20px;
        }
        
        .chart-section {
          background: white !important;
          border: 1px solid #e4e7ed;
          border-radius: 8px;
          padding: 16px;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .chart-section h3 {
          margin: 0 0 15px 0;
          font-size: 16px;
          color: #303133;
          border-bottom: 1px solid #e4e7ed;
          padding-bottom: 8px;
        }
        
        .chart-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .chart-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .chart-bar {
          flex: 1;
          height: 20px;
          background: #f5f7fa !important;
          border-radius: 10px;
          overflow: hidden;
          position: relative;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .bar-fill {
          height: 100%;
          border-radius: 10px;
          transition: width 0.3s ease;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .chart-label {
          min-width: 120px;
          font-size: 12px;
          color: #606266;
        }
        
        .print-footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #909399;
          border-top: 1px solid #e4e7ed;
          padding-top: 10px;
        }
        
        @media print {
          body {
            padding: 0;
          }
          
          .chart-section {
            break-inside: avoid;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div class="report-title">${reportType === 'weekly' ? '周' : reportType === 'monthly' ? '月' : '年'}报告</div>
        <div class="report-subtitle">${startDate} 至 ${endDate}</div>
      </div>
      
      <div class="overview-stats">
        <div class="stat-item">
          <div class="stat-value">${data.total}</div>
          <div class="stat-label">总申请数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.completed}</div>
          <div class="stat-label">已完成</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.pending}</div>
          <div class="stat-label">待处理</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.urgent}</div>
          <div class="stat-label">紧急申请</div>
        </div>
      </div>
      
      <div class="charts-container">
        ${generateChartSection('状态分布', data.statusBreakdown, data.total, formatStatus)}
        ${generateChartSection('部门分布', data.departmentBreakdown, data.total)}
        ${generateChartSection('分析类型分布', data.analysisTypeBreakdown, data.total)}
        ${generateChartSection('紧急程度分布', data.urgencyBreakdown, data.total, formatUrgency)}
        ${generateChartSection('生产环节分布', data.productionStageBreakdown, data.total)}
        ${generateChartSection('产线分布', data.productionLineBreakdown, data.total)}
      </div>
      
      <div class="print-footer">
        生成时间: ${new Date().toLocaleString('zh-CN')}
      </div>
    </body>
    </html>
  `;

  return html;
};

// 获取报告统计数据的路由
router.get('/stats', async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 6);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        endDate = now;
    }

    const data = await generateReportData(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      period
    );

    res.json({
      success: true,
      data: {
        ...data,
        period,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('获取报告统计数据失败:', error);
    res.status(500).json({ error: '获取报告统计数据失败' });
  }
});

// 获取自定义日期范围的统计数据
router.get('/custom-stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '缺少开始日期或结束日期' });
    }

    // 验证日期格式
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: '日期格式无效' });
    }
    
    if (start > end) {
      return res.status(400).json({ error: '开始日期不能晚于结束日期' });
    }

    const data = await generateReportData(startDate, endDate, 'custom');

    res.json({
      success: true,
      data: {
        ...data,
        period: 'custom',
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('获取自定义日期范围统计数据失败:', error);
    res.status(500).json({ error: '获取自定义日期范围统计数据失败' });
  }
});

// 生成报告
router.post('/generate', async (req, res) => {
  try {
    const { reportType, startDate, endDate, fileType = 'xlsx' } = req.body;
    // 移除用户ID要求，使用系统默认值
    const userId = 'system';

    // 强制使用Excel格式
    const actualFileType = 'xlsx';

    // 获取报告数据
    const data = await generateReportData(startDate, endDate, reportType);

    // 生成Excel文件
    const fileBuffer = await generateExcelReport(data, reportType, startDate, endDate);
    const fileName = `${reportType}_report_${startDate}_${endDate}.xlsx`;

    // 保存文件
    const uploadDir = path.join(__dirname, '../uploads/reports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, fileBuffer);

    // 保存报告记录到数据库
    const title = `${reportType === 'weekly' ? '周' : reportType === 'monthly' ? '月' : '年'}报告 (${startDate} 至 ${endDate})`;
    
    db.run(
      `INSERT INTO reports (title, report_type, start_date, end_date, generated_by, file_path, file_type, file_size) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, reportType, startDate, endDate, userId, filePath, actualFileType, fileBuffer.length],
      function(err) {
        if (err) {
          console.error('保存报告记录失败:', err);
          return res.status(500).json({ error: '保存报告记录失败' });
        }

        // 检查报告数量，如果超过10条则删除最旧的记录
        db.get('SELECT COUNT(*) as total FROM reports', (countErr, countResult) => {
          if (countErr) {
            console.error('获取报告总数失败:', countErr);
          } else if (countResult.total > 10) {
            // 删除最旧的记录
            db.all(
              `SELECT id, file_path FROM reports ORDER BY created_at ASC LIMIT ?`,
              [countResult.total - 10],
              (selectErr, oldReports) => {
                if (selectErr) {
                  console.error('获取旧报告失败:', selectErr);
                } else {
                  // 删除旧文件
                  oldReports.forEach(report => {
                    if (fs.existsSync(report.file_path)) {
                      fs.unlinkSync(report.file_path);
                    }
                  });
                  
                  // 删除数据库记录
                  const oldIds = oldReports.map(r => r.id);
                  if (oldIds.length > 0) {
                    db.run(
                      `DELETE FROM reports WHERE id IN (${oldIds.map(() => '?').join(',')})`,
                      oldIds,
                      (deleteErr) => {
                        if (deleteErr) {
                          console.error('删除旧报告失败:', deleteErr);
                        }
                      }
                    );
                  }
                }
              }
            );
          }
        });

        res.json({
          success: true,
          report: {
            id: this.lastID,
            title,
            reportType,
            startDate,
            endDate,
            fileType: actualFileType,
            fileSize: fileBuffer.length,
            createdAt: new Date().toISOString()
          }
        });
      }
    );
  } catch (error) {
    console.error('生成报告失败:', error);
    res.status(500).json({ error: '生成报告失败' });
  }
});

// 获取报告列表
router.get('/list', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  
  db.all(
    `SELECT * FROM reports 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [pageSize, (page - 1) * pageSize],
    (err, rows) => {
      if (err) {
        console.error('获取报告列表失败:', err);
        return res.status(500).json({ error: '获取报告列表失败' });
      }

      db.get('SELECT COUNT(*) as total FROM reports', (countErr, countResult) => {
        if (countErr) {
          console.error('获取报告总数失败:', countErr);
          return res.status(500).json({ error: '获取报告总数失败' });
        }

        res.json({
          success: true,
          reports: rows,
          pagination: {
            page: page,
            pageSize: pageSize,
            total: countResult.total,
            totalPages: Math.ceil(countResult.total / pageSize)
          }
        });
      });
    }
  );
});

// 下载报告
router.get('/download/:id', (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT * FROM reports WHERE id = ?',
    [id],
    (err, report) => {
      if (err) {
        console.error('查找报告失败:', err);
        return res.status(500).json({ error: '查找报告失败' });
      }

      if (!report) {
        return res.status(404).json({ error: '报告不存在' });
      }

      if (!fs.existsSync(report.file_path)) {
        return res.status(404).json({ error: '报告文件不存在' });
      }

      // 设置正确的Content-Type (只支持Excel)
      const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      res.setHeader('Content-Type', contentType);
      
      // 对文件名进行URL编码以处理中文字符
      const encodedFilename = encodeURIComponent(`${report.title}.xlsx`);
      const simpleFilename = `report_${report.id}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${simpleFilename}"; filename*=UTF-8''${encodedFilename}`);
      
      // 添加额外的头部信息来帮助浏览器识别文件
      res.setHeader('Content-Length', fs.statSync(report.file_path).size);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // 直接发送文件，不使用res.download()来避免重复设置Content-Disposition
      const fileStream = fs.createReadStream(report.file_path);
      fileStream.pipe(res);
    }
  );
});

// 删除报告
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT * FROM reports WHERE id = ?',
    [id],
    (err, report) => {
      if (err) {
        console.error('查找报告失败:', err);
        return res.status(500).json({ error: '查找报告失败' });
      }

      if (!report) {
        return res.status(404).json({ error: '报告不存在' });
      }

      // 删除文件
      if (fs.existsSync(report.file_path)) {
        fs.unlinkSync(report.file_path);
      }

      // 删除数据库记录
      db.run(
        'DELETE FROM reports WHERE id = ?',
        [id],
        function(deleteErr) {
          if (deleteErr) {
            console.error('删除报告失败:', deleteErr);
            return res.status(500).json({ error: '删除报告失败' });
          }

          res.json({ success: true, message: '报告删除成功' });
        }
      );
    }
  );
});

// 生成HTML报告路由
router.post('/generate-html', async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.body;

    // 获取报告数据
    const data = await generateReportData(startDate, endDate, reportType);

    // 生成HTML报告
    const htmlContent = generateHtmlReport(data, reportType, startDate, endDate);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (error) {
    console.error('生成HTML报告失败:', error);
    res.status(500).json({ error: '生成HTML报告失败' });
  }
});

// 生成工单明细Excel报告
const generateApplicationDetailsExcel = async (applications) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('工单明细');

  // 设置表头
  const headers = [
    '工单编号', '申请人', '申请部门', '生产线', '生产环节', '样品信息', 
    '分析类型', '项目名称', '委托事项', '紧急程度', '状态', 
    '申请时间', '完成时间', '分析师', '分析结果', '分析结论'
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = { 
    type: 'pattern', 
    pattern: 'solid', 
    fgColor: { argb: 'FFE6E6FA' } 
  };

  // 添加数据行
  applications.forEach(app => {
    const row = worksheet.addRow([
      app.application_number || '',
      app.applicant_name || '',
      app.department || '',
      app.production_line_name || '',
      app.production_stage_name || '',
      app.sample_info || '',
      app.analysis_type || '',
      app.project || '',
      app.commission_matter || '',
      app.urgency === 'urgent' ? '紧急' : app.urgency === 'high' ? '高' : '正常',
      app.status === 'pending' ? '待处理' : 
      app.status === 'processing' ? '处理中' :
      app.status === 'completed' ? '已完成' :
      app.status === 'cancelled' ? '已取消' : app.status,
      app.created_at ? new Date(app.created_at).toLocaleString('zh-CN') : '',
      app.completed_at ? new Date(app.completed_at).toLocaleString('zh-CN') : '',
      app.analyst_name || '',
      app.analysis_result || '',
      app.analysis_conclusion || ''
    ]);
  });

  // 设置列宽
  worksheet.columns = [
    { width: 15 }, // 工单编号
    { width: 12 }, // 申请人
    { width: 15 }, // 申请部门
    { width: 15 }, // 生产线
    { width: 15 }, // 生产环节
    { width: 20 }, // 样品信息
    { width: 15 }, // 分析类型
    { width: 15 }, // 项目名称
    { width: 25 }, // 委托事项
    { width: 10 }, // 紧急程度
    { width: 10 }, // 状态
    { width: 18 }, // 申请时间
    { width: 18 }, // 完成时间
    { width: 12 }, // 分析师
    { width: 30 }, // 分析结果
    { width: 30 }  // 分析结论
  ];

  // 设置边框
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  return await workbook.xlsx.writeBuffer();
};

// 导出工单明细Excel
router.post('/export-details', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    // 移除用户ID要求，使用系统默认值
    const userId = 'system';

    if (!startDate || !endDate) {
      return res.status(400).json({ error: '请提供开始和结束日期' });
    }

    // 查询工单明细数据 - 修复为实际存在的字段
    const query = `
      SELECT 
        id,
        work_order_number,
        applicant,
        sampler,
        department,
        project,
        phone,
        urgency,
        expected_date,
        target_compounds,
        detection_method,
        report_requirement,
        special_requirements,
        analysis_type,
        status,
        created_at,
        updated_at,
        reject_reason
      FROM applications
      WHERE created_at BETWEEN ? AND ?
      ORDER BY created_at DESC
    `;

    db.all(query, [startDate, endDate], async (err, applications) => {
      if (err) {
        console.error('查询工单明细失败:', err);
        return res.status(500).json({ error: '查询工单明细失败' });
      }

      try {
        const fileBuffer = await generateApplicationDetailsExcel(applications);
        const fileName = `工单明细_${startDate}_${endDate}.xlsx`;

        // 保存文件
        const uploadDir = path.join(__dirname, '../uploads/reports');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, fileBuffer);

        // 保存报告记录到数据库
        const title = `工单明细 (${startDate} 至 ${endDate})`;
        
        db.run(
          `INSERT INTO reports (title, report_type, start_date, end_date, generated_by, file_path, file_type, file_size) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [title, 'details', startDate, endDate, userId, filePath, 'xlsx', fileBuffer.length],
          function(err) {
            if (err) {
              console.error('保存报告记录失败:', err);
              return res.status(500).json({ error: '保存报告记录失败' });
            }

            // 检查报告数量，如果超过10条则删除最旧的记录
            db.get('SELECT COUNT(*) as total FROM reports', (countErr, countResult) => {
              if (countErr) {
                console.error('获取报告总数失败:', countErr);
              } else if (countResult.total > 10) {
                // 删除最旧的记录
                db.all(
                  `SELECT id, file_path FROM reports ORDER BY created_at ASC LIMIT ?`,
                  [countResult.total - 10],
                  (selectErr, oldReports) => {
                    if (selectErr) {
                      console.error('获取旧报告失败:', selectErr);
                    } else {
                      // 删除旧文件
                      oldReports.forEach(report => {
                        if (fs.existsSync(report.file_path)) {
                          fs.unlinkSync(report.file_path);
                        }
                      });
                      
                      // 删除数据库记录
                      const oldIds = oldReports.map(r => r.id);
                      if (oldIds.length > 0) {
                        db.run(
                          `DELETE FROM reports WHERE id IN (${oldIds.map(() => '?').join(',')})`,
                          oldIds,
                          (deleteErr) => {
                            if (deleteErr) {
                              console.error('删除旧报告失败:', deleteErr);
                            }
                          }
                        );
                      }
                    }
                  }
                );
              }
            });

            res.json({
              success: true,
              report: {
                id: this.lastID,
                title,
                reportType: 'details',
                startDate,
                endDate,
                fileType: 'xlsx',
                fileSize: fileBuffer.length,
                createdAt: new Date().toISOString()
              }
            });
          }
        );
      } catch (error) {
        console.error('生成工单明细Excel失败:', error);
        res.status(500).json({ error: '生成工单明细Excel失败' });
      }
    });
  } catch (error) {
    console.error('导出工单明细失败:', error);
    res.status(500).json({ error: '导出工单明细失败' });
  }
});

module.exports = router;
