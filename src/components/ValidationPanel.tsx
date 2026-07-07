import { useMemo, useState } from 'react';
import type { ProjectModel, ValidationIssue } from '../domain/types';
import { validateProject } from '../domain/validators';

type Props = {
  project: ProjectModel;
  onLocate?: (nodeId: string) => void;
};

export default function ValidationPanel({ project, onLocate }: Props) {
  const issues = useMemo(() => validateProject(project), [project]);

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const [showWarnings, setShowWarnings] = useState(false);

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>
        校验结果
        {issues.length === 0 && <span style={{ color: '#27ae60', marginLeft: 8 }}>✓ 无问题</span>}
      </h4>

      {errors.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: '#e74c3c', marginBottom: 4 }}>
            ❌ 错误 ({errors.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {errors.map((issue, idx) => (
              <IssueItem key={idx} issue={issue} onLocate={onLocate} />
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: '#f39c12' }}>
              ⚠️ 警告 ({warnings.length})
            </span>
            <button
              type="button"
              onClick={() => setShowWarnings((v) => !v)}
              style={{
                padding: '2px 8px',
                border: '1px solid #f39c12',
                background: showWarnings ? '#fff2d9' : '#fff',
                color: '#b06f00',
                borderRadius: 3,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {showWarnings ? '收起' : '展开'}
            </button>
          </div>
          {showWarnings && (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {warnings.map((issue, idx) => (
                <IssueItem key={idx} issue={issue} onLocate={onLocate} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function IssueItem({ issue, onLocate }: { issue: ValidationIssue; onLocate?: (nodeId: string) => void }) {
  // Extract the unit/connection ID from the path for click-to-locate
  const handleClick = () => {
    if (!onLocate || !issue.path) return;
    // path format: "units.V-101.label.zh" or "connections.L-001.from"
    const parts = issue.path.split('.');
    if (parts[0] === 'units' && parts[1]) {
      onLocate(parts[1]);
    } else if (parts[0] === 'connections' && parts[1]) {
      onLocate(`conn:${parts[1]}`);
    } else if (parts[0] === 'annotations' && parts[1]) {
      onLocate(`ann-${parts[1]}`);
    }
  };

  const isClickable = !!onLocate && !!issue.path;

  return (
    <li
      style={{
        marginBottom: 4,
        lineHeight: 1.4,
        cursor: isClickable ? 'pointer' : 'default',
        padding: '2px 4px',
        borderRadius: 3,
        transition: 'background 0.15s',
      }}
      onClick={handleClick}
      onMouseEnter={(e) => { if (isClickable) e.currentTarget.style.background = '#eef6ff'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      title={isClickable ? '点击定位到对应元件' : undefined}
    >
      <span>{issue.message}</span>
      {issue.path && (
        <span style={{ color: '#666', marginLeft: 6, fontSize: 11, textDecoration: isClickable ? 'underline' : 'none' }}>
          [{issue.path.split('.').slice(0, 2).join('.')}]
        </span>
      )}
    </li>
  );
}
