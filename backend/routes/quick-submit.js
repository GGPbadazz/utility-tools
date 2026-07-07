const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取产线列表
router.get('/production-lines', (req, res) => {
  db.all('SELECT * FROM production_lines WHERE is_active = 1 ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('获取产线列表失败:', err);
      return res.status(500).json({ error: '获取产线列表失败' });
    }
    res.json(rows);
  });
});

// 获取生产环节列表
router.get('/production-lines/:id/stages', (req, res) => {
  const lineId = req.params.id;
  db.all(
    'SELECT * FROM production_stages WHERE production_line_id = ? ORDER BY name',
    [lineId],
    (err, rows) => {
      if (err) {
        console.error('获取生产环节列表失败:', err);
        return res.status(500).json({ error: '获取生产环节列表失败' });
      }
      res.json(rows);
    }
  );
});

// 获取快速提交模板列表
router.get('/quick-submit-templates', (req, res) => {
  db.all('SELECT * FROM quick_submit_templates ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('获取模板列表失败:', err);
      return res.status(500).json({ error: '获取模板列表失败' });
    }
    res.json(rows);
  });
});

// 获取模板详情
router.get('/quick-submit-templates/:id', (req, res) => {
  const templateId = req.params.id;
  db.get(
    'SELECT * FROM quick_submit_templates WHERE id = ?',
    [templateId],
    (err, row) => {
      if (err) {
        console.error('获取模板详情失败:', err);
        return res.status(500).json({ error: '获取模板详情失败' });
      }
      if (!row) {
        return res.status(404).json({ error: '模板不存在' });
      }
      res.json(row);
    }
  );
});

// 创建快速提交模板
router.post('/quick-submit-templates', (req, res) => {
  const {
    name,
    description,
    production_line,
    stage,
    analysis_types,
    target_compounds,
    detection_method,
    report_requirement
  } = req.body;

  const query = `
    INSERT INTO quick_submit_templates (
      name, description, production_line, stage,
      analysis_types, target_compounds, detection_method,
      report_requirement
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      name,
      description,
      production_line,
      stage,
      analysis_types,
      target_compounds,
      detection_method,
      report_requirement
    ],
    function(err) {
      if (err) {
        console.error('创建模板失败:', err);
        return res.status(500).json({ error: '创建模板失败' });
      }
      res.json({
        success: true,
        id: this.lastID
      });
    }
  );
});

// 快速提交申请
router.post('/applications/quick-submit', (req, res) => {
  const {
    applicant,
    department,
    phone,
    productionLine,
    productionStage,
    template,
    urgency,
    sampleName,
    quantity,
    unit,
    hazardLevel,
    storageCondition,
    notes,
    sampler
  } = req.body;

  // 验证必填字段
  if (!applicant || !department || !sampler || !sampleName) {
    return res.status(400).json({ error: '申请人、部门、取样人和样品名称为必填项' });
  }

  // 验证产线和生产环节为必填
  if (!productionLine || !productionStage) {
    return res.status(400).json({ error: '产线和生产环节为必填项' });
  }

  const workOrderNumber = generateWorkOrderNumber();
  const userId = req.user.id;

  // 开始事务
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 插入主申请记录
    const insertApplication = `
      INSERT INTO applications (
        work_order_number, applicant, department,
        phone, urgency, template_id, production_line_id,
        production_stage_id, is_quick_submit, user_id,
        status, created_at, sampler
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_sample', CURRENT_TIMESTAMP, ?)
    `;

    db.run(
      insertApplication,
      [
        workOrderNumber,
        applicant,
        department,
        phone || 'N/A', // Use provided phone or default to 'N/A'
        urgency,
        template,
        productionLine,
        productionStage,
        1, // is_quick_submit
        userId,
        sampler
      ],
      function(err) {
        if (err) {
          console.error('提交申请失败:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: '提交申请失败' });
        }

        const applicationId = this.lastID;

        // 插入样品信息
        const insertSample = `
          INSERT INTO samples (
            application_id, name, quantity, unit,
            hazard_level, storage_condition
          ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.run(
          insertSample,
          [
            applicationId,
            sampleName,
            quantity,
            unit,
            hazardLevel,
            storageCondition
          ],
          (err) => {
            if (err) {
              console.error('保存样品信息失败:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ error: '保存样品信息失败' });
            }

            db.run('COMMIT');
            res.json({
              success: true,
              workOrderNumber,
              applicationId
            });
          }
        );
      }
    );
  });
});

// 生成工单号
function generateWorkOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `QS${year}${month}${day}${random}`;
}

module.exports = router;
