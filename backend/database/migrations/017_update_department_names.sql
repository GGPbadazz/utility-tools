-- Update department names from English identifiers to Chinese names
-- This migration converts existing English department identifiers to Chinese names

UPDATE applications 
SET department = '示例部门A' 
WHERE department = 'research';

UPDATE applications 
SET department = '实验室' 
WHERE department = 'quality';

UPDATE applications 
SET department = '示例部门B' 
WHERE department = 'production';

UPDATE applications 
SET department = '示例部门A' 
WHERE department = 'sales';

UPDATE applications 
SET department = '示例部门B' 
WHERE department = 'IT';

UPDATE applications 
SET department = '样品管理' 
WHERE department = 'procurement';

-- Also update any drafts table if it exists
UPDATE drafts 
SET department = '示例部门A' 
WHERE department = 'research';

UPDATE drafts 
SET department = '实验室' 
WHERE department = 'quality';

UPDATE drafts 
SET department = '示例部门B' 
WHERE department = 'production';

UPDATE drafts 
SET department = '示例部门A' 
WHERE department = 'sales';

UPDATE drafts 
SET department = '示例部门B' 
WHERE department = 'IT';

UPDATE drafts 
SET department = '样品管理' 
WHERE department = 'procurement';
