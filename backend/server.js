const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./database');
const quickSubmitRoutes = require('./routes/quick-submit');
const exportRoutes = require('./routes/export');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3002;
const ALT_PORT = process.env.ALT_PORT || 3001;

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// 内存使用监控
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(`内存使用: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}, 30000); // 每30秒打印一次内存使用情况

// 中间件
app.use(helmet());

const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
];
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : defaultCorsOrigins;

// CORS配置
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 限制请求频率
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 从环境变量读取或默认15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100 // 从环境变量读取或默认100个请求
});
app.use(limiter);

// 快速提交相关路由
app.use('/api', quickSubmitRoutes);

// 导出和管理员路由
app.use('/api/export', exportRoutes);
app.use('/api/admin', exportRoutes);

// 报告路由
app.use('/api/reports', reportsRoutes);

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    console.log('文件上传检查:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });

    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    // Excel文件的MIME类型检查
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv',
      'application/octet-stream' // 允许二进制流类型（很多Excel文件会被识别为这种类型）
    ];
    
    const mimetypeValid = allowedMimeTypes.includes(file.mimetype);
    
    if (mimetypeValid && extname) {
      return cb(null, true);
    } else {
      console.log('文件类型不允许:', file.mimetype, path.extname(file.originalname));
      cb(new Error('只允许上传图片、PDF、Word、Excel和CSV文件'));
    }
  }
});

// 生成工单号
function generateWorkOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // 获取当天的订单计数
  // 在实际应用中，这应该从数据库中查询当天的订单数量
  // 这里我们使用一个简单的随机数来模拟
  const orderCount = Math.floor(Math.random() * 999) + 1;
  const orderNumber = String(orderCount).padStart(3, '0');
  
  return `CA${year}${month}${day}-${orderNumber}`;
}

// 健康检查端点
app.get('/api/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'connected', // 假设数据库已连接
    version: '1.0.0'
  };
  
  res.json(healthStatus);
});

// 服务器统计端点
app.get('/api/stats', (req, res) => {
  const stats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    pid: process.pid
  };
  
  res.json(stats);
});

// API 路由
// 提交申请 - 支持JSON和FormData两种格式
app.post('/api/applications', (req, res, next) => {
  // 检查Content-Type来决定如何处理请求
  const contentType = req.get('Content-Type') || '';
  
  if (contentType.includes('multipart/form-data')) {
    // 如果是FormData（带文件上传），使用multer
    upload.array('attachments', 5)(req, res, next);
  } else {
    // 如果是JSON或其他格式，直接处理
    next();
  }
}, async (req, res) => {
  console.log('收到申请提交请求:');
  console.log('Content-Type:', req.get('Content-Type'));
  console.log('Request body:', req.body);
  console.log('Request files:', req.files);
  
  try {
    const {
      batchNumber,
      applicant,
      sampler,
      department,
      project,
      phone,
      urgency,
      expectedDate,
      samples,
      analysisTypes,
      targetCompounds,
      detectionMethod,
      reportRequirement,
      specialRequirements,
      reflectionStep,
      productionLine
    } = req.body;

    console.log('解析的字段:', {
      batchNumber,
      applicant,
      sampler,
      department,
      project,
      phone,
      urgency,
      expectedDate,
      samples: typeof samples,
      analysisTypes: typeof analysisTypes,
      targetCompounds,
      detectionMethod,
      reportRequirement,
      specialRequirements,
      reflectionStep,
      productionLine
    });

    // 验证必填字段 - 只要求取样人
    if (!sampler) {
      console.log('缺少必填字段');
      return res.status(400).json({ 
        success: false,
        error: '请填写取样人字段' 
      });
    }

    // 处理JSON字段
    let parsedSamples, parsedAnalysisTypes;
    try {
      parsedSamples = typeof samples === 'string' ? JSON.parse(samples) : (samples || []);
      parsedAnalysisTypes = typeof analysisTypes === 'string' ? JSON.parse(analysisTypes) : (analysisTypes || []);
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      return res.status(400).json({
        success: false,
        error: 'JSON数据格式错误'
      });
    }

    // 验证样品
    if (!parsedSamples || parsedSamples.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请至少添加一个样品'
      });
    }

    // 分析类型现在是可选的（快速申请可能不需要）
    // if (!parsedAnalysisTypes || parsedAnalysisTypes.length === 0) {
    //   return res.status(400).json({
    //     success: false,
    //     error: '请至少选择一种分析类型'
    //   });
    // }

    // 生成工单号
    const workOrderNumber = `WO${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(Date.now()).slice(-4)}`;

    console.log('准备插入数据:', {
      workOrderNumber,
      applicant,
      sampler,
      department,
      project,
      phone,
      urgency,
      expectedDate,
      targetCompounds,
      detectionMethod,
      reportRequirement,
      specialRequirements,
      samplesCount: parsedSamples.length,
      analysisTypesCount: parsedAnalysisTypes.length
    });

    // 插入申请记录
    const insertQuery = `
      INSERT INTO applications (
        work_order_number, batch_number, applicant, sampler, department, project, phone,
        urgency, expected_date, target_compounds, detection_method,
        report_requirement, special_requirements, reflection_step, production_line, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_sample', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const result = await new Promise((resolve, reject) => {
      db.run(insertQuery, [
        workOrderNumber,
        batchNumber || null,
        applicant,
        sampler, 
        department,
        project || null,
        phone || null,
        urgency || 'normal',
        expectedDate || null,
        targetCompounds || null,
        detectionMethod || null,
        reportRequirement || 'standard',
        specialRequirements || null,
        reflectionStep || null,
        productionLine || null
      ], function(err) {
        if (err) {
          console.error('数据库插入错误:', err);
          reject(err);
        } else {
          console.log('申请记录插入成功, ID:', this.lastID);
          resolve({ insertId: this.lastID });
        }
      });
    });

    const applicationId = result.insertId;

    // 插入样品信息
    for (let i = 0; i < parsedSamples.length; i++) {
      const sample = parsedSamples[i];
      const sampleQuery = `
        INSERT INTO samples (
          application_id, name, type, description, quantity, unit, storage_condition, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      await new Promise((resolve, reject) => {
        db.run(sampleQuery, [
          applicationId,
          sample.name || '',
          sample.type || '',
          sample.description || '',
          sample.quantity || 0,
          sample.unit || 'g',
          sample.storageCondition || ''
        ], function(err) {
          if (err) {
            console.error('样品插入错误:', err);
            reject(err);
          } else {
            console.log(`样品 ${i + 1} 插入成功`);
            resolve();
          }
        });
      });
    }

    // 插入分析类型（如果有专门的表，否则可以存储为JSON）
    // 这里假设我们将分析类型存储在applications表中
    const updateAnalysisTypes = `
      UPDATE applications SET analysis_type = ? WHERE id = ?
    `;
    
    await new Promise((resolve, reject) => {
      db.run(updateAnalysisTypes, [
        JSON.stringify(parsedAnalysisTypes),
        applicationId
      ], function(err) {
        if (err) {
          console.error('分析类型更新错误:', err);
          reject(err);
        } else {
          console.log('分析类型更新成功');
          resolve();
        }
      });
    });

    console.log('申请提交成功:', workOrderNumber);

    res.json({
      success: true,
      message: '申请提交成功',
      workOrderNumber: workOrderNumber,
      applicationId: applicationId
    });

  } catch (error) {
    console.error('提交申请时出错:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误: ' + error.message
    });
  }
});

// 获取申请列表
app.get('/api/applications', (req, res) => {
  console.log('GET /api/applications - No authentication required');
  
  // Return all applications with additional fields for production line and target compounds
  const query = `
    SELECT id, work_order_number, batch_number, applicant, department, project,
           urgency, expected_date, status, created_at, sampler,
           target_compounds, production_line, reflection_step
    FROM applications
    ORDER BY created_at DESC
  `;
  const params = [];

  console.log('Executing query:', query);
  console.log('Query parameters:', params);

  db.all(query, params, async (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '获取申请列表失败' });
    }
    
    console.log('Query results:', rows);
    
    // 为每个申请获取样品和分析类型信息
    const applicationsWithDetails = await Promise.all(
      rows.map(async (application) => {
        return new Promise((resolve) => {
          // 获取样品信息
          db.all('SELECT * FROM samples WHERE application_id = ?', [application.id], (err, samples) => {
            if (err) samples = [];
            
            // 获取分析类型
            db.all('SELECT analysis_type FROM analysis_types WHERE application_id = ?', [application.id], (err, types) => {
              if (err) types = [];
              
              resolve({
                ...application,
                samples,
                analysisTypes: types.map(t => t.analysis_type)
              });
            });
          });
        });
      })
    );
    
    res.json(applicationsWithDetails);
  });
});

// 获取申请详情
app.get('/api/applications/:id', (req, res) => {
  const applicationId = req.params.id;

  // 获取主申请信息
  db.get('SELECT * FROM applications WHERE id = ?', [applicationId], (err, application) => {
    if (err || !application) {
      return res.status(404).json({ error: '申请不存在' });
    }

    // 获取样品信息
    db.all('SELECT * FROM samples WHERE application_id = ?', [applicationId], (err, samples) => {
      if (err) samples = [];

      // 获取分析类型
      db.all('SELECT analysis_type FROM analysis_types WHERE application_id = ?', [applicationId], (err, types) => {
        if (err) types = [];

        // 获取附件信息
        db.all('SELECT * FROM attachments WHERE application_id = ?', [applicationId], (err, attachments) => {
          if (err) attachments = [];

          // 获取分析结果
          db.get('SELECT * FROM analysis_results WHERE application_id = ?', [applicationId], (err, results) => {
            const analysisResults = err ? null : results;

            res.json({
              ...application,
              samples,
              analysisTypes: types.map(t => t.analysis_type),
              attachments,
              analysisResults
            });
          });
        });
      });
    });
  });
});

// 更新申请状态
app.put('/api/applications/:id/status', (req, res) => {
  const applicationId = req.params.id;
  const { status } = req.body;
  
  if (!status || !['waiting_sample', 'analyzing', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }
  
  db.run(
    'UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, applicationId],
    function(err) {
      if (err) {
        console.error('更新状态失败:', err);
        return res.status(500).json({ error: '更新状态失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '申请不存在' });
      }
      
      res.json({ success: true, status });
    }
  );
});

// 更新申请信息
app.put('/api/applications/:id', (req, res) => {
  const applicationId = req.params.id;
  const { 
    status, 
    reject_reason, 
    applicant, 
    sampler, 
    department, 
    project, 
    urgency, 
    batch_number, 
    sampling_date, 
    notes 
  } = req.body;
  
  if (status && !['waiting_sample', 'analyzing', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }
  
  if (urgency && !['low', 'normal', 'high', 'urgent'].includes(urgency)) {
    return res.status(400).json({ error: '无效的紧急程度' });
  }
  
  let updateQuery = 'UPDATE applications SET ';
  let updateParams = [];
  let updateFields = [];
  
  // 支持的字段列表
  const allowedFields = {
    status,
    reject_reason,
    applicant,
    sampler,
    department,
    project,
    urgency,
    batch_number,
    sampling_date,
    notes
  };
  
  // 构建更新字段
  Object.keys(allowedFields).forEach(field => {
    if (allowedFields[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      updateParams.push(allowedFields[field]);
    }
  });
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: '没有提供要更新的字段' });
  }
  
  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateQuery += updateFields.join(', ') + ' WHERE id = ?';
  updateParams.push(applicationId);
  
  db.run(updateQuery, updateParams, function(err) {
    if (err) {
      console.error('更新申请失败:', err);
      return res.status(500).json({ error: '更新申请失败' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: '申请不存在' });
    }
    
    res.json({ success: true, message: '申请更新成功' });
  });
});

// 取消申请
app.patch('/api/applications/:id/cancel', (req, res) => {
  const applicationId = req.params.id;
  const { cancel_reason } = req.body;
  
  // 首先检查申请是否存在以及当前状态
  db.get('SELECT * FROM applications WHERE id = ?', [applicationId], (err, application) => {
    if (err) {
      console.error('查询申请失败:', err);
      return res.status(500).json({ error: '查询申请失败' });
    }
    
    if (!application) {
      return res.status(404).json({ error: '申请不存在' });
    }
    
    // 检查是否可以取消（只有等待样品状态可以取消）
    if (application.status !== 'waiting_sample') {
      return res.status(400).json({ error: '只有等待样品状态的申请可以取消' });
    }
    
    // 更新申请状态为取消
    db.run(
      'UPDATE applications SET status = ?, cancel_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['cancelled', cancel_reason || null, applicationId],
      function(err) {
        if (err) {
          console.error('取消申请失败:', err);
          return res.status(500).json({ error: '取消申请失败' });
        }
        
        res.json({ success: true, message: '申请已取消' });
      }
    );
  });
});

// 更新分析结果
app.patch('/api/applications/:id/analysis', (req, res) => {
  const applicationId = req.params.id;
  const { analysis_conclusion, analysis_result, analyst_name } = req.body;
  
  // 验证必填字段
  if (!analysis_conclusion || !analysis_result || !analyst_name) {
    return res.status(400).json({ error: '分析结论、分析结果和分析员姓名均为必填项' });
  }
  
  // 首先检查申请是否存在
  db.get('SELECT * FROM applications WHERE id = ?', [applicationId], (err, application) => {
    if (err) {
      console.error('查询申请失败:', err);
      return res.status(500).json({ error: '查询申请失败' });
    }
    
    if (!application) {
      return res.status(404).json({ error: '申请不存在' });
    }
    
    // 开始事务
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // 更新applications表的分析信息
      db.run(
        `UPDATE applications SET 
         analysis_conclusion = ?, 
         analysis_result = ?, 
         analyst_name = ?, 
         analysis_completed_at = CURRENT_TIMESTAMP,
         status = 'completed',
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [analysis_conclusion, analysis_result, analyst_name, applicationId],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            console.error('更新申请分析信息失败:', err);
            return res.status(500).json({ error: '更新分析信息失败' });
          }
          
          // 更新或插入analysis_results表
          db.run(
            `INSERT OR REPLACE INTO analysis_results 
             (application_id, conclusion, data, analyst_name, created_at, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [applicationId, analysis_conclusion, analysis_result, analyst_name],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                console.error('更新分析结果表失败:', err);
                return res.status(500).json({ error: '更新分析结果失败' });
              }
              
              db.run('COMMIT');
              res.json({ 
                success: true, 
                message: '分析结果保存成功，申请状态已更新为完成' 
              });
            }
          );
        }
      );
    });
  });
});

// 保存分析结果
app.post('/api/applications/:id/results', upload.array('attachments', 5), (req, res) => {
  const applicationId = req.params.id;
  const { conclusion, data, notes } = req.body;
  
  // 开始事务
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // 检查是否已有结果记录
    db.get('SELECT id FROM analysis_results WHERE application_id = ?', [applicationId], (err, row) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: '保存分析结果失败' });
      }
      
      let query;
      let params;
      
      if (row) {
        // 更新现有记录
        query = `
          UPDATE analysis_results 
          SET conclusion = ?, data = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE application_id = ?
        `;
        params = [conclusion, data, notes, applicationId];
      } else {
        // 创建新记录
        query = `
          INSERT INTO analysis_results (application_id, conclusion, data, notes)
          VALUES (?, ?, ?, ?)
        `;
        params = [applicationId, conclusion, data, notes];
      }
      
      db.run(query, params, function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '保存分析结果失败' });
        }
        
        // 更新申请状态为已完成（如果尚未完成）
        db.run(
          'UPDATE applications SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != "completed"',
          [applicationId]
        );
        
        // 处理附件
        if (req.files && req.files.length > 0) {
          const insertAttachment = `
            INSERT INTO result_attachments (
              result_id, filename, original_name, file_path, file_size, mime_type
            ) VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          const resultId = row ? row.id : this.lastID;
          
          req.files.forEach(file => {
            db.run(insertAttachment, [
              resultId, file.filename, file.originalname,
              file.path, file.size, file.mimetype
            ]);
          });
        }
        
        db.run('COMMIT');
        res.json({ success: true });
      });
    });
  });
});

// Draft management endpoints - 无用户验证版本

// 获取草稿列表
app.get('/api/drafts', (req, res) => {
  db.all(
    'SELECT id, title, created_at, updated_at FROM drafts ORDER BY updated_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '获取草稿列表失败' });
      }
      res.json(rows);
    }
  );
});

// 获取指定草稿的详情
app.get('/api/drafts/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM drafts WHERE id = ?',
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: '获取草稿失败' });
      }
      
      if (!row) {
        return res.status(404).json({ error: '草稿不存在' });
      }
      
      // 解析 JSON 字段
      const draft = {
        ...row,
        samples: row.samples ? JSON.parse(row.samples) : [],
        analysisTypes: row.analysis_types ? JSON.parse(row.analysis_types) : []
      };
      
      res.json(draft);
    }
  );
});

// 保存草稿
app.post('/api/drafts', (req, res) => {
  const {
    title = 'Untitled Draft',
    form_type = 'standard',
    applicant,
    department,
    project,
    phone,
    urgency = 'normal',
    expectedDate,
    targetCompounds,
    detectionMethod,
    reportRequirement = 'standard',
    specialRequirements,
    samples = [],
    analysisTypes = [],
    sampler
  } = req.body;
  
  // 插入新草稿
  db.run(
    `INSERT INTO drafts (
      title, applicant, department, project, phone,
      urgency, expected_date, target_compounds, detection_method,
      report_requirement, special_requirements, samples, analysis_types, sampler
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title, applicant, department, project, phone,
      urgency, expectedDate, targetCompounds, detectionMethod,
      reportRequirement, specialRequirements, 
      JSON.stringify(samples), JSON.stringify(analysisTypes), sampler
    ],
    function(err) {
      if (err) {
        console.error('保存草稿失败:', err);
        return res.status(500).json({ error: '保存草稿失败' });
      }
      res.json({ 
        success: true, 
        id: this.lastID,
        message: '草稿保存成功' 
      });
    }
  );
});

// 更新草稿
app.put('/api/drafts/:id', (req, res) => {
  const { id } = req.params;
  const {
    title = 'Untitled Draft',
    applicant,
    department,
    project,
    phone,
    urgency = 'normal',
    expectedDate,
    targetCompounds,
    detectionMethod,
    reportRequirement = 'standard',
    specialRequirements,
    samples = [],
    analysisTypes = [],
    sampler
  } = req.body;
  
  db.run(
    `UPDATE drafts SET 
      title = ?, applicant = ?, department = ?, project = ?, phone = ?,
      urgency = ?, expected_date = ?, target_compounds = ?, detection_method = ?,
      report_requirement = ?, special_requirements = ?, samples = ?, analysis_types = ?, 
      sampler = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [
      title, applicant, department, project, phone,
      urgency, expectedDate, targetCompounds, detectionMethod,
      reportRequirement, specialRequirements, 
      JSON.stringify(samples), JSON.stringify(analysisTypes), sampler, id
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '更新草稿失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '草稿不存在' });
      }
      
      res.json({ success: true, message: '草稿更新成功' });
    }
  );
});

// 删除草稿
app.delete('/api/drafts/:id', (req, res) => {
  const { id } = req.params;
  
  db.run(
    'DELETE FROM drafts WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '删除草稿失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '草稿不存在' });
      }
      
      res.json({ success: true, message: '草稿删除成功' });
    }
  );
});

// Department management endpoints (admin only)

// 获取分析类型目录
app.get('/api/analysis-types', (req, res) => {
  db.all('SELECT * FROM analysis_type_catalog WHERE is_active = 1 ORDER BY sort_order, name', (err, rows) => {
    if (err) return res.status(500).json({ error: '获取分析类型失败' });
    res.json(rows);
  });
});

// 添加分析类型（系统设置用）
app.post('/api/analysis-types', (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '分析类型名称不能为空' });
  db.run(
    'INSERT INTO analysis_type_catalog (name, description) VALUES (?, ?)',
    [name.trim(), description || ''],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(400).json({ error: '分析类型已存在' });
        return res.status(500).json({ error: '添加失败' });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// 删除分析类型（软删除）
app.delete('/api/analysis-types/:id', (req, res) => {
  db.run(
    'UPDATE analysis_type_catalog SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: '删除失败' });
      if (this.changes === 0) return res.status(404).json({ error: '不存在' });
      res.json({ success: true });
    }
  );
});

// 获取系统统计数据
app.get('/api/system/stats', (req, res) => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const queries = [
    new Promise(r => db.get('SELECT COUNT(*) as total FROM applications', (e, row) => r(row?.total || 0))),
    new Promise(r => db.get("SELECT COUNT(*) as c FROM applications WHERE status = 'completed'", (e, row) => r(row?.c || 0))),
    new Promise(r => db.get("SELECT COUNT(*) as c FROM applications WHERE status = 'analyzing'", (e, row) => r(row?.c || 0))),
    new Promise(r => db.get("SELECT COUNT(*) as c FROM applications WHERE status = 'waiting_sample'", (e, row) => r(row?.c || 0))),
    new Promise(r => db.get("SELECT COUNT(*) as c FROM applications WHERE status = 'completed' AND created_at >= ?", [monthStart], (e, row) => r(row?.c || 0))),
    new Promise(r => db.get("SELECT COUNT(*) as c FROM applications WHERE urgency = 'urgent' AND status != 'completed' AND status != 'cancelled'", (e, row) => r(row?.c || 0))),
  ];
  Promise.all(queries).then(([total, completed, analyzing, waiting, monthCompleted, urgentPending]) => {
    res.json({ total, completed, analyzing, waiting, monthCompleted, urgentPending });
  }).catch(() => res.status(500).json({ error: '获取统计数据失败' }));
});

// 获取所有部门
app.get('/api/departments', (req, res) => {
  db.all('SELECT * FROM departments WHERE is_active = 1 ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '获取部门列表失败' });
    }
    res.json(rows);
  });
});

// 添加部门 (仅管理员)
app.post('/api/departments', (req, res) => {
  const { name, description } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '部门名称不能为空' });
  }
  
  db.run(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [name.trim(), description || ''],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: '部门名称已存在' });
        }
        return res.status(500).json({ error: '添加部门失败' });
      }
      res.json({ 
        success: true, 
        id: this.lastID,
        message: '部门添加成功' 
      });
    }
  );
});

// 更新部门 (仅管理员)
app.put('/api/departments/:id', (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '部门名称不能为空' });
  }
  
  db.run(
    'UPDATE departments SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name.trim(), description || '', id],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: '部门名称已存在' });
        }
        return res.status(500).json({ error: '更新部门失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '部门不存在' });
      }
      
      res.json({ success: true, message: '部门更新成功' });
    }
  );
});

// 删除部门 (仅管理员)
app.delete('/api/departments/:id', (req, res) => {
  const { id } = req.params;
  
  // 软删除 - 设置为不活跃状态
  db.run(
    'UPDATE departments SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '删除部门失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '部门不存在' });
      }
      
      res.json({ success: true, message: '部门删除成功' });
    }
  );
});

// Production lines management endpoints (admin only)

// 获取所有生产线
app.get('/api/production-lines', (req, res) => {
  db.all('SELECT * FROM production_lines WHERE is_active = 1 ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '获取生产线列表失败' });
    }
    res.json(rows);
  });
});

// 添加生产线 (仅管理员)
app.post('/api/production-lines', (req, res) => {
  const { name, description } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '生产线名称不能为空' });
  }
  
  db.run(
    'INSERT INTO production_lines (name, description) VALUES (?, ?)',
    [name.trim(), description || ''],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: '生产线名称已存在' });
        }
        return res.status(500).json({ error: '添加生产线失败' });
      }
      res.json({ 
        success: true, 
        id: this.lastID,
        message: '生产线添加成功' 
      });
    }
  );
});

// 更新生产线 (仅管理员)
app.put('/api/production-lines/:id', (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '生产线名称不能为空' });
  }
  
  db.run(
    'UPDATE production_lines SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name.trim(), description || '', id],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: '生产线名称已存在' });
        }
        return res.status(500).json({ error: '更新生产线失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '生产线不存在' });
      }
      
      res.json({ success: true, message: '生产线更新成功' });
    }
  );
});

// 删除生产线 (仅管理员)
app.delete('/api/production-lines/:id', (req, res) => {
  const { id } = req.params;
  
  // 软删除 - 设置为不活跃状态
  db.run(
    'UPDATE production_lines SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '删除生产线失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '生产线不存在' });
      }
      
      res.json({ success: true, message: '生产线删除成功' });
    }
  );
});

// 导入数据接口
app.post('/api/import/applications', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要导入的文件' });
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // 使用Promise来处理异步数据库操作
    const promises = data.map((row, index) => {
      return new Promise((resolve, reject) => {
        try {
          // 跳过空行或无关键信息的行
          if (!row['申请人'] && !row['工单号'] && !row['项目']) {
            skippedCount++;
            resolve();
            return;
          }

          // 验证必填字段
          if (!row['申请人']) {
            errors.push(`第${index + 2}行：缺少申请人信息`);
            resolve();
            return;
          }

          // 生成工单号（如果没有提供）
          const workOrderNumber = row['工单号'] || `WO${Date.now()}${Math.floor(Math.random() * 1000)}`;

          // 插入申请数据
          db.run(
            `INSERT INTO applications (
              work_order_number, applicant, department, project, phone,
              urgency, expected_date, target_compounds, detection_method,
              report_requirement, special_requirements, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              workOrderNumber,
              row['申请人'] || '',
              row['部门'] || '',
              row['项目'] || '',
              row['联系电话'] || '',
              parseUrgency(row['紧急程度']) || 'normal',
              row['期望完成日期'] || null,
              row['目标化合物'] || '',
              row['检测方法'] || '',
              row['报告要求'] || '',
              row['特殊要求'] || '',
              'waiting_sample'
            ],
            function(err) {
              if (err) {
                errors.push(`第${index + 2}行：数据插入失败 - ${err.message}`);
                resolve();
              } else {
                const applicationId = this.lastID;
                importedCount++;
                
                // 如果有样品信息，插入样品数据
                if (row['样品名称']) {
                  const sampleNames = row['样品名称'].split(',').map(s => s.trim()).filter(s => s);
                  const sampleTypes = (row['样品类型'] || '').split(',').map(s => s.trim());
                  const sampleQuantities = (row['样品数量'] || '').split(',').map(s => s.trim());
                  
                  sampleNames.forEach((name, i) => {
                    if (name) {
                      db.run(
                        `INSERT INTO samples (
                          application_id, name, type, quantity, unit, created_at
                        ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                        [
                          applicationId,
                          name,
                          sampleTypes[i] || '',
                          parseSampleQuantity(sampleQuantities[i]).quantity || '',
                          parseSampleQuantity(sampleQuantities[i]).unit || 'g'
                        ]
                      );
                    }
                  });
                }
                
                resolve();
              }
            }
          );
        } catch (error) {
          errors.push(`第${index + 2}行：数据处理失败 - ${error.message}`);
          resolve();
        }
      });
    });

    // 等待所有异步操作完成
    Promise.all(promises).then(() => {
      // 删除临时文件
      const fs = require('fs');
      fs.unlinkSync(req.file.path);

      const message = `导入完成！成功导入${importedCount}条记录${skippedCount > 0 ? `，跳过${skippedCount}条空行` : ''}`;
      
      if (errors.length > 0) {
        res.status(206).json({
          message: message,
          errors: errors.slice(0, 10) // 只显示前10个错误
        });
      } else {
        res.json({ message: message });
      }
    });

  } catch (error) {
    console.error('数据导入错误:', error);
    res.status(500).json({ error: '数据导入失败: ' + error.message });
  }
});

// 辅助函数：解析紧急程度
function parseUrgency(urgencyText) {
  if (!urgencyText) return 'normal';
  const text = urgencyText.toString().toLowerCase();
  if (text.includes('紧急') || text.includes('urgent') || text.includes('high')) return 'urgent';
  if (text.includes('普通') || text.includes('normal')) return 'normal';
  if (text.includes('低') || text.includes('low')) return 'low';
  return 'normal';
}

// 辅助函数：解析样品数量
function parseSampleQuantity(quantityText) {
  if (!quantityText) return { quantity: '', unit: 'g' };
  const match = quantityText.toString().match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
  if (match) {
    return { quantity: match[1], unit: match[2] };
  }
  return { quantity: quantityText.toString(), unit: 'g' };
}

// 清除所有工单数据
app.post('/api/system/clear-workorders', (req, res) => {
  try {
    // 开始事务
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // 删除所有相关数据
      db.run('DELETE FROM analysis_results', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '清除分析结果失败: ' + err.message });
        }
      });
      
      db.run('DELETE FROM samples', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '清除样品数据失败: ' + err.message });
        }
      });
      
      db.run('DELETE FROM applications', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '清除申请数据失败: ' + err.message });
        }
      });
      
      db.run('DELETE FROM reports', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '清除报告数据失败: ' + err.message });
        }
      });
      
      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '提交事务失败: ' + err.message });
        }
        
        console.log('所有工单数据清除完成');
        res.json({ message: '所有工单数据清除完成' });
      });
    });
  } catch (error) {
    console.error('工单清除错误:', error);
    res.status(500).json({ error: '工单清除失败: ' + error.message });
  }
});

// 重置系统工单历史
app.post('/api/system/reset-workorders', (req, res) => {
  try {
    // 开始事务
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // 删除所有相关数据
      db.run('DELETE FROM analysis_results', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '重置分析结果失败: ' + err.message });
        }
      });
      
      db.run('DELETE FROM samples', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '重置样品数据失败: ' + err.message });
        }
      });
      
      db.run('DELETE FROM applications', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '重置申请数据失败: ' + err.message });
        }
      });
      
      db.run('DELETE FROM reports', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '重置报告数据失败: ' + err.message });
        }
      });
      
      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '提交事务失败: ' + err.message });
        }
        
        console.log('系统工单历史重置完成');
        res.json({ message: '系统工单历史重置完成' });
      });
    });
  } catch (error) {
    console.error('系统重置错误:', error);
    res.status(500).json({ error: '系统重置失败: ' + error.message });
  }
});

// 独立文件上传接口 - 供前端 el-upload 组件使用
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    res.json({
      success: true,
      url: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({ success: false, error: '文件上传失败: ' + error.message });
  }
});

// 静态文件服务（用于下载附件）
app.use('/uploads', express.static(uploadDir));

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('全局错误处理:', err.stack);
  
  // 数据库错误
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({ error: '数据约束错误' });
  }
  
  // 文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: '文件大小超出限制' });
  }
  
  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: '无效的令牌' });
  }
  
  // 默认错误
  res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 启动服务器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`本地访问: http://localhost:${PORT}`);
  console.log(`允许的前端来源: ${corsOrigins.join(', ')}`);
});

// 进程异常处理
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    db.close();
    process.exit(0);
  });
});

// 设置服务器超时
server.timeout = 30000; // 30秒超时
