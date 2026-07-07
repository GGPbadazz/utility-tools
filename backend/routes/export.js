const express = require('express');
const router = express.Router();
const db = require('../database');
const XLSX = require('xlsx');

// 导出所有申请数据
router.get('/applications', async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        a.id,
        a.work_order_number,
        a.applicant,
        a.department,
        a.project,
        a.phone,
        a.urgency,
        a.expected_date,
        a.target_compounds,
        a.detection_method,
        a.report_requirement,
        a.special_requirements,
        a.status,
        a.created_at,
        a.updated_at,
        ar.conclusion as analysis_conclusion,
        ar.data as analysis_data,
        ar.notes as analysis_notes
      FROM applications a
      LEFT JOIN analysis_results ar ON a.id = ar.application_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    
    if (startDate && endDate) {
      query += ' AND DATE(a.created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY a.created_at DESC';
    
    db.all(query, params, (err, applications) => {
      if (err) {
        console.error('查询申请数据失败:', err);
        return res.status(500).json({ error: '查询申请数据失败' });
      }
      
      // 查询样品信息
      const sampleQuery = `
        SELECT 
          s.application_id,
          s.name,
          s.type,
          s.description,
          s.quantity,
          s.unit,
          s.storage_condition,
          s.hazard_level
        FROM samples s
        WHERE s.application_id IN (${applications.map(() => '?').join(',')})
      `;
      
      const applicationIds = applications.map(app => app.id);
      
      db.all(sampleQuery, applicationIds, (err, samples) => {
        if (err) {
          console.error('查询样品数据失败:', err);
        }
        
        // 组织数据
        const samplesByApp = {};
        (samples || []).forEach(sample => {
          if (!samplesByApp[sample.application_id]) {
            samplesByApp[sample.application_id] = [];
          }
          samplesByApp[sample.application_id].push(sample);
        });
        
        // 创建Excel数据
        const excelData = applications.map(app => {
          const appSamples = samplesByApp[app.id] || [];
          const sampleNames = appSamples.map(s => s.name).join(', ');
          const sampleTypes = appSamples.map(s => s.type).join(', ');
          const sampleQuantities = appSamples.map(s => `${s.quantity}${s.unit}`).join(', ');
          
          return {
            '工单号': app.work_order_number,
            '申请人': app.applicant,
            '部门': formatDepartment(app.department),
            '项目': app.project || '',
            '联系电话': app.phone || '',
            '紧急程度': formatUrgency(app.urgency),
            '期望完成日期': app.expected_date || '',
            '样品名称': sampleNames,
            '样品类型': sampleTypes,
            '样品数量': sampleQuantities,
            '目标化合物': app.target_compounds || '',
            '检测方法': app.detection_method || '',
            '报告要求': formatReportRequirement(app.report_requirement),
            '特殊要求': app.special_requirements || '',
            '状态': formatStatus(app.status),
            '分析结论': app.analysis_conclusion || '',
            '检测数据': app.analysis_data || '',
            '分析备注': app.analysis_notes || '',
            '申请时间': formatDate(app.created_at),
            '更新时间': formatDate(app.updated_at)
          };
        });
        
        // 创建工作簿
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '申请数据');
        
        // 设置列宽
        const colWidths = [
          { wch: 12 }, // 工单号
          { wch: 10 }, // 申请人
          { wch: 10 }, // 部门
          { wch: 20 }, // 项目
          { wch: 15 }, // 联系电话
          { wch: 10 }, // 紧急程度
          { wch: 15 }, // 期望完成日期
          { wch: 20 }, // 样品名称
          { wch: 15 }, // 样品类型
          { wch: 15 }, // 样品数量
          { wch: 30 }, // 目标化合物
          { wch: 15 }, // 检测方法
          { wch: 15 }, // 报告要求
          { wch: 30 }, // 特殊要求
          { wch: 10 }, // 状态
          { wch: 30 }, // 分析结论
          { wch: 30 }, // 检测数据
          { wch: 30 }, // 分析备注
          { wch: 20 }, // 申请时间
          { wch: 20 }  // 更新时间
        ];
        ws['!cols'] = colWidths;
        
        // 生成Excel文件
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="applications.xlsx"');
        
        res.send(buffer);
      });
    });
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({ error: '导出数据失败' });
  }
});

// 管理员备份数据库
router.post('/backup-database', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const sourceFile = path.join(__dirname, '../chemical_analysis.db');
    const backupFile = path.join(__dirname, '../chemical_analysis.db.backup');
    
    fs.copyFileSync(sourceFile, backupFile);
    res.json({ success: true, message: '数据库备份成功' });
  } catch (error) {
    console.error('备份数据库失败:', error);
    res.status(500).json({ error: '备份数据库失败' });
  }
});

// 清理数据库
router.post('/cleanup-database', (req, res) => {
  try {
    // 删除30天前的已取消申请
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    db.run(
      `DELETE FROM applications WHERE status = 'cancelled' AND created_at < ?`,
      [cutoffDate.toISOString()],
      function(err) {
        if (err) {
          console.error('清理数据库失败:', err);
          return res.status(500).json({ error: '清理数据库失败' });
        }
        
        res.json({ 
          success: true, 
          message: `已清理 ${this.changes} 条过期数据` 
        });
      }
    );
  } catch (error) {
    console.error('清理数据库失败:', error);
    res.status(500).json({ error: '清理数据库失败' });
  }
});

// 导出系统日志
router.get('/export-logs', (req, res) => {
  try {
    const logs = [
      '系统启动 - ' + new Date().toISOString(),
      '数据库连接成功',
      '用户访问记录...'
    ];
    
    const logContent = logs.join('\n');
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="system.log"');
    res.send(logContent);
  } catch (error) {
    console.error('导出日志失败:', error);
    res.status(500).json({ error: '导出日志失败' });
  }
});

// 格式化函数
function formatDepartment(dept) {
  const deptMap = {
    'research': '研发部',
    'quality': '质量部',
    'production': '生产部',
    'sales': '销售部'
  };
  return deptMap[dept] || dept;
}

function formatUrgency(urgency) {
  const urgencyMap = {
    'urgent': '紧急',
    'high': '高',
    'normal': '普通',
    'low': '低'
  };
  return urgencyMap[urgency] || urgency;
}

function formatStatus(status) {
  const statusMap = {
    'pending': '待处理',
    'processing': '处理中',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

function formatReportRequirement(requirement) {
  const requirementMap = {
    'standard': '标准报告',
    'detailed': '详细报告',
    'simple': '简化报告',
    'certificate': '检测证书'
  };
  return requirementMap[requirement] || requirement;
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('zh-CN');
}

module.exports = router;
