-- 更新申请状态到新的四种状态系统
-- 等待样品(waiting_sample), 分析中(analyzing), 完成(completed), 取消(cancelled)

-- 首先备份当前状态
CREATE TABLE IF NOT EXISTS status_backup AS 
SELECT id, status as old_status FROM applications;

-- 更新状态映射
-- pending -> waiting_sample (等待样品)
UPDATE applications SET status = 'waiting_sample' WHERE status = 'pending';

-- processing -> analyzing (分析中)
UPDATE applications SET status = 'analyzing' WHERE status = 'processing';

-- completed -> completed (完成) - 保持不变
-- rejected -> cancelled (取消)
UPDATE applications SET status = 'cancelled' WHERE status = 'rejected';

-- 更新时间戳
UPDATE applications SET updated_at = CURRENT_TIMESTAMP;
