import { useEffect, useRef, useState } from 'react';
import type { Unit, Connection, Port, Annotation, DisplayMode, UnitType, ConnectionKind } from '../domain/types';
import { getPresetsForType } from '../domain/presets';
import {
  insulationCodes,
  materialCodes,
  pipeMaterialSpecs,
  valveTypeCodes,
} from '../domain/engineeringCodes';
import { formatPipeLabel, parsePipeLabel, type PipeLabel } from '../domain/piping';

type Props = {
  selectedUnit?: { id: string; unit: Unit } | null;
  selectedConnection?: Connection | null;
  selectedAnnotation?: Annotation | null;
  selectedPortId?: string;
  annotations?: Annotation[];
  focusKey?: string;
  displayMode: DisplayMode;
  onUpdateUnit: (unitId: string, updates: Partial<Unit>) => void;
  onRenameUnit?: (oldId: string, newId: string) => void;
  onUpdateConnection: (connId: string, updates: Partial<Connection>) => void;
  onUpdateAnnotation: (annId: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
  onAddAnnotation?: (targetId: string) => void;
  onAddPort: (unitId: string, portId: string, port: Port) => void;
  onDeletePort: (unitId: string, portId: string) => void;
};

export default function PropertyPanel({
  selectedUnit,
  selectedConnection,
  selectedAnnotation,
  selectedPortId,
  annotations = [],
  focusKey,
  displayMode,
  onUpdateUnit,
  onRenameUnit,
  onUpdateConnection,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onAddAnnotation,
  onAddPort,
  onDeletePort,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isFocusPulse, setIsFocusPulse] = useState(false);
  const t = (zh: string, en: string) => (displayMode === 'zh' ? zh : en);
  const getPresetLabel = (label: string) => {
    const parts = label.split('/').map((item) => item.trim()).filter(Boolean);
    if (displayMode === 'zh') {
      return parts[0] || label;
    }
    return parts.length > 1 ? parts[parts.length - 1] : (parts[0] || label);
  };

  useEffect(() => {
    if (!focusKey) return;
    if (panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setIsFocusPulse(true);
    const timer = window.setTimeout(() => {
      setIsFocusPulse(false);
    }, 900);
    return () => clearTimeout(timer);
  }, [focusKey]);

  const panelClassName = isFocusPulse ? 'property-panel-focus' : '';

  if (!selectedUnit && !selectedConnection && !selectedAnnotation) {
    return (
      <div
        ref={panelRef}
        className={panelClassName}
        style={{ padding: 16, color: '#888', fontSize: 13 }}
      >
        {t('点击节点或连接线查看并编辑属性', 'Select a unit, connection, or annotation to edit')}
      </div>
    );
  }

  if (selectedUnit) {
    const relatedAnns = annotations.filter((a) => a.target === selectedUnit.id);
    return (
      <div ref={panelRef} className={panelClassName} style={{ minHeight: 0 }}>
        <UnitEditor
          displayMode={displayMode}
          getPresetLabel={getPresetLabel}
          id={selectedUnit.id}
          unit={selectedUnit.unit}
          selectedPortId={selectedPortId}
          onUpdateUnit={onUpdateUnit}
          onRenameUnit={onRenameUnit}
          onAddPort={onAddPort}
          onDeletePort={onDeletePort}
        />
        <RelatedAnnotations
          displayMode={displayMode}
          targetId={selectedUnit.id}
          annotations={relatedAnns}
          onUpdateAnnotation={onUpdateAnnotation}
          onDeleteAnnotation={onDeleteAnnotation}
          onAddAnnotation={onAddAnnotation}
        />
      </div>
    );
  }

  if (selectedConnection) {
    const relatedAnns = annotations.filter((a) => a.target === selectedConnection.id);
    return (
      <div ref={panelRef} className={panelClassName} style={{ minHeight: 0 }}>
        <ConnectionEditor
          displayMode={displayMode}
          connection={selectedConnection}
          onUpdateConnection={onUpdateConnection}
        />
        <RelatedAnnotations
          displayMode={displayMode}
          targetId={selectedConnection.id}
          annotations={relatedAnns}
          onUpdateAnnotation={onUpdateAnnotation}
          onDeleteAnnotation={onDeleteAnnotation}
          onAddAnnotation={onAddAnnotation}
        />
      </div>
    );
  }

  if (selectedAnnotation) {
    return (
      <div ref={panelRef} className={panelClassName} style={{ minHeight: 0 }}>
        <AnnotationEditor
          displayMode={displayMode}
          annotation={selectedAnnotation}
          onUpdateAnnotation={onUpdateAnnotation}
          onDeleteAnnotation={onDeleteAnnotation}
        />
      </div>
    );
  }

  return null;
}

// --- Related Annotations Section ---
function RelatedAnnotations({
  targetId,
  annotations,
  displayMode,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onAddAnnotation,
}: {
  targetId: string;
  displayMode: DisplayMode;
  annotations: Annotation[];
  onUpdateAnnotation: (annId: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
  onAddAnnotation?: (targetId: string) => void;
}) {
  const t = (zh: string, en: string) => (displayMode === 'zh' ? zh : en);
  return (
    <div style={{ borderTop: '1px solid #eee', padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: 12 }}>{t('📝 关联注释', '📝 Annotations')}</strong>
        {onAddAnnotation && (
          <button
            onClick={() => onAddAnnotation(targetId)}
            style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #ccc', borderRadius: 3, background: '#fff', cursor: 'pointer' }}
          >
            {t('+ 添加注释', '+ Add Annotation')}
          </button>
        )}
      </div>
      {annotations.length === 0 && (
        <div style={{ fontSize: 11, color: '#999' }}>{t('暂无注释', 'No annotations')}</div>
      )}
      {annotations.map((ann) => (
        <div key={ann.id} style={{ marginBottom: 6, padding: '4px 6px', background: '#fffde7', borderRadius: 3, border: '1px solid #fff9c4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#666' }}>{ann.id}</span>
            <button
              onClick={() => onDeleteAnnotation(ann.id)}
              style={{ fontSize: 10, color: '#e74c3c', border: 'none', background: 'none', cursor: 'pointer' }}
            >✕</button>
          </div>
          <TextInput
            value={ann.text?.zh || ''}
            onValueChange={(value) => onUpdateAnnotation(ann.id, { text: { ...ann.text, zh: value } })}
            style={{ width: '100%', fontSize: 11, border: '1px solid #eee', borderRadius: 2, padding: '2px 4px', marginTop: 2 }}
            placeholder={t('注释内容', 'Annotation content')}
          />
        </div>
      ))}
    </div>
  );
}

// --- Unit Editor ---

function UnitEditor({
  id,
  unit,
  selectedPortId,
  displayMode,
  getPresetLabel,
  onUpdateUnit,
  onRenameUnit,
  onAddPort,
  onDeletePort,
}: {
  id: string;
  unit: Unit;
  selectedPortId?: string;
  displayMode: DisplayMode;
  getPresetLabel: (label: string) => string;
  onUpdateUnit: (unitId: string, updates: Partial<Unit>) => void;
  onRenameUnit?: (oldId: string, newId: string) => void;
  onAddPort: (unitId: string, portId: string, port: Port) => void;
  onDeletePort: (unitId: string, portId: string) => void;
}) {
  const t = (zh: string, en: string) => (displayMode === 'zh' ? zh : en);
  const [newPortId, setNewPortId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState('');
  const getAttrLabel = (key: string) => {
    const zhLabelMap: Record<string, string> = {
      equipmentCode: '设备代号',
      equipmentName: '设备名称',
      volume: '容积',
      material: '材料',
      design_pressure: '设计压力',
      design_temperature: '设计温度',
      agitator: '搅拌器',
      agitato: '搅拌器',
      designPressure: '设计压力',
      designTemperature: '设计温度',
      customType: '自定义类型',
      vesselType: '容器类型',
      pumpType: '泵型',
      valveType: '阀门类型',
      medium: '介质',
      insulation: '绝热',
      DN: '公称直径',
      pressure: '压力',
      temperature: '温度',
      equipmenttype: '设备类型',
      equipmentType: '设备类型',
      processType: '工艺类型',
      process_class: '工艺级别',
    };
    const enLabelMap: Record<string, string> = {
      equipmentCode: 'Equipment Code',
      equipmentName: 'Equipment Name',
      volume: 'Volume',
      material: 'Material',
      design_pressure: 'Design Pressure',
      design_temperature: 'Design Temperature',
      agitator: 'Agitator',
      agitato: 'Agitator',
      designPressure: 'Design Pressure',
      designTemperature: 'Design Temperature',
      customType: 'Custom Type',
      vesselType: 'Vessel Type',
      pumpType: 'Pump Type',
      valveType: 'Valve Type',
      medium: 'Medium',
      insulation: 'Insulation',
      DN: 'DN',
      pressure: 'Pressure',
      temperature: 'Temperature',
      equipmenttype: 'Equipment Type',
      equipmentType: 'Equipment Type',
      processType: 'Process Type',
      process_class: 'Process Class',
    };
    return displayMode === 'zh' ? (zhLabelMap[key] || key) : (enLabelMap[key] || key);
  };

  const startRename = () => {
    setEditingId(id);
    setDraftId(id);
  };

  const confirmRename = () => {
    const trimmed = draftId.trim();
    if (trimmed && trimmed !== id && onRenameUnit) {
      onRenameUnit(id, trimmed);
    }
    setEditingId(null);
  };

  const updateLabel = (field: 'zh' | 'en', value: string) => {
    onUpdateUnit(id, { label: { ...unit.label, [field]: value } });
  };

  const updateAttr = (key: string, value: string) => {
    onUpdateUnit(id, { attrs: { ...(unit.attrs || {}), [key]: value } });
  };
  const valveType = String(unit.attrs?.valveType || '').trim().toUpperCase();
  const hasKnownValveType = valveTypeCodes.some((item) => item.code === valveType);

  const handleAddPort = () => {
    // If no port ID given, pass empty string so useProjectMutations auto-generates IN#/OUT#
    const pid = newPortId.trim();
    onAddPort(id, pid, { kind: 'pipe', DN: 50, side: 'right', direction: 'output' });
    setNewPortId('');
  };
  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div style={{ marginBottom: 8 }}>
        {editingId !== null ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <TextInput
              value={draftId}
              onValueChange={setDraftId}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditingId(null); }}
              autoFocus
              style={{ ...inputStyle, fontWeight: 'bold', fontSize: 14 }}
            />
            <button onClick={confirmRename} style={btnStyle}>✓</button>
            <button onClick={() => setEditingId(null)} style={btnStyle}>{t('取消', 'Cancel')}</button>
          </div>
        ) : (
          <h3 style={{ margin: 0, fontSize: 14, cursor: 'pointer' }} onClick={startRename} title={t('点击编辑设备 UID', 'Click to edit unit UID')}>
            🔧 {id} <span style={{ fontSize: 10, color: '#999' }}>✏️</span>
          </h3>
        )}
      </div>

      <FieldRow label={t('类型', 'Type')}>
        <select
          value={unit.type}
          onChange={(e) => onUpdateUnit(id, { type: e.target.value as UnitType })}
          style={inputStyle}
        >
          <option value="vessel">{t('容器', 'Vessel')}</option>
          <option value="pump">{t('泵', 'Pump')}</option>
          <option value="valve">{t('阀门', 'Valve')}</option>
          <option value="instrument">{t('仪表', 'Instrument')}</option>
          <option value="junction">{t('节点', 'Junction')}</option>
          <option value="custom">{t('自定义', 'Custom')}</option>
        </select>
      </FieldRow>

      {/* Preset selector */}
      <FieldRow label={t('预设模板', 'Preset Template')}>
        <select
          value=""
          onChange={(e) => {
            const presets = getPresetsForType(unit.type);
            const found = presets.find(([key]) => key === e.target.value);
            if (found) {
              const [, preset] = found;
              onUpdateUnit(id, {
                type: preset.type,
                customType: preset.customType,
                attrs: { ...(unit.attrs || {}), ...preset.attrs },
                ports: { ...(unit.ports || {}), ...preset.ports },
              });
            }
          }}
          style={inputStyle}
        >
          <option value="" disabled>{t('选择预设模板...', 'Select preset...')}</option>
          {getPresetsForType(unit.type).map(([key, p]) => (
            <option key={key} value={key}>{getPresetLabel(p.label)}</option>
          ))}
        </select>
      </FieldRow>

      {/* Custom type name - only show when type is 'custom' */}
      {unit.type === 'custom' && (
        <FieldRow label={t('自定义类型', 'Custom Type')}>
          <TextInput
            value={unit.customType || ''}
            onValueChange={(value) => onUpdateUnit(id, { customType: value })}
            placeholder={t('示例: 换热器, 反应器...', 'Examples: Heat Exchanger, Reactor...')}
            style={inputStyle}
          />
        </FieldRow>
      )}

      <FieldRow label={t('中文名', 'Chinese Name')}>
        <TextInput value={unit.label?.zh || ''} onValueChange={(value) => updateLabel('zh', value)} style={inputStyle} />
      </FieldRow>
      <FieldRow label={t('英文名', 'English Name')}>
        <TextInput value={unit.label?.en || ''} onValueChange={(value) => updateLabel('en', value)} style={inputStyle} />
      </FieldRow>

      {unit.type === 'valve' && (
        <>
          <FieldRow label={t('阀门类型', 'Valve Type')}>
            <select
              value={hasKnownValveType ? valveType : '__CUSTOM__'}
              onChange={(e) => {
                const next = e.target.value;
                if (next === '__CUSTOM__') {
                  updateAttr('valveType', '');
                } else {
                  updateAttr('valveType', next);
                }
              }}
              style={inputStyle}
            >
              <option value="__CUSTOM__">{t('自定义', 'Custom')}</option>
              {valveTypeCodes.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.code} - {type.zh}
                </option>
              ))}
            </select>
          </FieldRow>
          {!hasKnownValveType && (
            <FieldRow label={t('自定义阀门类型', 'Custom Valve Type')}>
              <TextInput value={valveType} onValueChange={(value) => updateAttr('valveType', value)} style={inputStyle} />
            </FieldRow>
          )}
        </>
      )}

      {/* Custom attrs */}
      <h4 style={{ margin: '12px 0 4px', fontSize: 12, color: '#666' }}>{t('属性', 'Attributes')}</h4>
      {unit.attrs &&
        Object.entries(unit.attrs)
          .filter(([k]) => {
            if (unit.type === 'valve' && k === 'valveType') return false;
            return true;
          })
        .map(([k, v]) => (
        <FieldRow key={k} label={getAttrLabel(k)}>
          <TextInput value={String(v ?? '')} onValueChange={(value) => updateAttr(k, value)} style={inputStyle} />
        </FieldRow>
      ))}

      {/* Ports */}
      <h4 style={{ margin: '12px 0 4px', fontSize: 12, color: '#666' }}>{t('端口', 'Ports')}</h4>
      {unit.ports && Object.entries(unit.ports).map(([pid, port]) => (
        <PortEditor
          key={pid}
          unitId={id}
          portId={pid}
          port={port}
          unit={unit}
          isHighlighted={pid === selectedPortId}
          displayMode={displayMode}
          onUpdateUnit={onUpdateUnit}
          onDeletePort={onDeletePort}
        />
      ))}

      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <TextInput
          value={newPortId}
          onValueChange={setNewPortId}
          placeholder={t('新端口ID', 'New Port ID')}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={handleAddPort} style={btnStyle}>{t('+ 添加端口', '+ Add Port')}</button>
      </div>
    </div>
  );
}

// --- Port Editor ---

function PortEditor({
  unitId,
  portId,
  port,
  unit,
  isHighlighted,
  displayMode,
  onUpdateUnit,
  onDeletePort,
}: {
  unitId: string;
  portId: string;
  port: Port;
  unit: Unit;
  isHighlighted?: boolean;
  displayMode: DisplayMode;
  onUpdateUnit: (unitId: string, updates: Partial<Unit>) => void;
  onDeletePort: (unitId: string, portId: string) => void;
}) {
  const t = (zh: string, en: string) => (displayMode === 'zh' ? zh : en);
  const updatePort = (updates: Partial<Port>) => {
    const ports = { ...(unit.ports || {}) };
    ports[portId] = { ...port, ...updates };
    onUpdateUnit(unitId, { ports });
  };

  // Direction color indicator
  const portDirection: 'input' | 'output' = port.direction === 'output' ? 'output' : 'input';
  const dirColor = portDirection === 'input' ? '#27ae60' : '#e74c3c';
  const currentSide: string = port.side || 'right';

  return (
    <div
      style={{
        marginBottom: 6,
        padding: 6,
        background: isHighlighted ? '#fff8e1' : '#f0f0f0',
        borderRadius: 4,
        border: isHighlighted ? '1px solid #f4b400' : '1px solid transparent',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: dirColor, marginRight: 4 }} />
          {portId}
        </strong>
        <button onClick={() => onDeletePort(unitId, portId)} style={deleteBtnStyle}>×</button>
      </div>
      <div style={{ margin: '4px 0' }}>
        <span style={{ fontSize: 11, color: '#666', display: 'block' }}>
          UID: {port.uid || t('(未生成)', '(Not Generated)')}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4, fontSize: 11 }}>
        {/* Direction toggle */}
        <div style={{ position: 'relative', height: 28 }}>
          <button
            type="button"
            onClick={() => updatePort({ direction: portDirection === 'input' ? 'output' : 'input' })}
            style={{
              ...inputStyle,
              position: 'relative',
              width: '100%',
              height: 28,
              lineHeight: '1',
              padding: '0',
              borderRadius: 14,
              background: '#edf2f7',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              overflow: 'hidden',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <span style={{ zIndex: 1, paddingLeft: 8, color: portDirection === 'input' ? '#fff' : '#64748b', minWidth: 44, textAlign: 'left' }}>
              {t('输入', 'Input')}
            </span>
            <span style={{ zIndex: 1, paddingRight: 8, color: portDirection === 'output' ? '#fff' : '#64748b', minWidth: 44, textAlign: 'right' }}>
              {t('输出', 'Output')}
            </span>
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: portDirection === 'input' ? 2 : '50%',
                width: 'calc(50% - 3px)',
                height: 'calc(100% - 4px)',
                background: portDirection === 'input' ? '#27ae60' : '#e74c3c',
                borderRadius: 12,
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>
      {/* Side selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        <div />
        <button
          type="button"
          onClick={() => updatePort({ side: 'top' })}
          style={{
            ...inputStyle,
            fontSize: 11,
            background: currentSide === 'top' ? '#e8f4ff' : '#fff',
            border: currentSide === 'top' ? '1px solid #3b82f6' : '1px solid #d0d0d0',
            color: currentSide === 'top' ? '#1d4ed8' : '#333',
            minHeight: 28,
            padding: '5px 4px',
            lineHeight: 1,
          }}
        >
          {t('上', 'Top')}
        </button>
        <div />
        <button
          type="button"
          onClick={() => updatePort({ side: 'left' })}
          style={{
            ...inputStyle,
            fontSize: 11,
            background: currentSide === 'left' ? '#e8f4ff' : '#fff',
            border: currentSide === 'left' ? '1px solid #3b82f6' : '1px solid #d0d0d0',
            color: currentSide === 'left' ? '#1d4ed8' : '#333',
            minHeight: 28,
            padding: '5px 4px',
            lineHeight: 1,
          }}
        >
          {t('左', 'Left')}
        </button>
        <div />
        <button
          type="button"
          onClick={() => updatePort({ side: 'right' })}
          style={{
            ...inputStyle,
            fontSize: 11,
            background: currentSide === 'right' ? '#e8f4ff' : '#fff',
            border: currentSide === 'right' ? '1px solid #3b82f6' : '1px solid #d0d0d0',
            color: currentSide === 'right' ? '#1d4ed8' : '#333',
            minHeight: 28,
            padding: '5px 4px',
            lineHeight: 1,
          }}
        >
          {t('右', 'Right')}
        </button>
        <div />
        <button
          type="button"
          onClick={() => updatePort({ side: 'bottom' })}
          style={{
            ...inputStyle,
            fontSize: 11,
            background: currentSide === 'bottom' ? '#e8f4ff' : '#fff',
            border: currentSide === 'bottom' ? '1px solid #3b82f6' : '1px solid #d0d0d0',
            color: currentSide === 'bottom' ? '#1d4ed8' : '#333',
            minHeight: 28,
            padding: '5px 4px',
            lineHeight: 1,
          }}
        >
          {t('下', 'Bottom')}
        </button>
        <div />
      </div>
        {/* Kind selector */}
        <select
          value={port.kind}
          onChange={(e) => updatePort({ kind: e.target.value as ConnectionKind })}
          style={{ ...inputStyle, fontSize: 11 }}
        >
          <option value="pipe">{t('管道', 'Pipe')}</option>
          <option value="signal">{t('信号', 'Signal')}</option>
          <option value="cable">{t('电缆', 'Cable')}</option>
        </select>
        {/* DN */}
        <input
          type="number"
          value={port.DN || ''}
          placeholder={t('DN', 'DN')}
          onChange={(e) => updatePort({ DN: parseInt(e.target.value) || undefined })}
          style={{ ...inputStyle, fontSize: 11 }}
        />
      </div>
    </div>
  );
}

// --- Connection Editor ---

function ConnectionEditor({
  connection,
  displayMode,
  onUpdateConnection,
}: {
  connection: Connection;
  displayMode: DisplayMode;
  onUpdateConnection: (connId: string, updates: Partial<Connection>) => void;
}) {
  const t = (zh: string, en: string) => (displayMode === 'zh' ? zh : en);
  const updateAttr = (key: string, value: string) => {
    onUpdateConnection(connection.id, { attrs: { ...(connection.attrs || {}), [key]: value } });
  };

  const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim().toUpperCase() : '');

  const isValidPipeLabelObject = (label: PipeLabel): boolean => {
    if (label.kind === 'standard') {
      return !!(label.mediumCode && label.equipmentTag && label.sequenceNo && label.diameter > 0 && label.pressureCode && label.insulationCode);
    }
    if (label.kind === 'jacketed') {
      return !!(
        label.mediumCode &&
        label.equipmentTag &&
        label.sequenceNo &&
        label.diameter > 0 &&
        label.pressureCode &&
        label.insulationCode &&
        label.jacket.jacketTypeCode &&
        label.jacket.jacketMediumCode &&
        label.jacket.jacketHeatCode &&
        label.jacket.jacketDiameter > 0 &&
        label.jacket.jacketPressureCode &&
        label.jacket.jacketInsulationCode
      );
    }
    return false;
  };

  const getCurrentLineText = () => {
    if (typeof connection.attrs?.lineLabel === 'string' && connection.attrs.lineLabel.length > 0) {
      return connection.attrs.lineLabel;
    }
    if (connection.pipeLabel) {
      return formatPipeLabel(connection.pipeLabel);
    }
    return '';
  };

  const setLineLabel = (raw: string) => {
    const lineText = raw.trim();
    const currentAttrs = { ...(connection.attrs || {}) };
    if (!lineText) {
      if (currentAttrs.lineLabel) delete currentAttrs.lineLabel;
      onUpdateConnection(connection.id, {
        pipeLabel: undefined,
        medium: undefined,
        attrs: { ...currentAttrs },
      });
      return;
    }

    const parsed = parsePipeLabel(lineText);
    if (parsed) {
      onUpdateConnection(connection.id, {
        pipeLabel: parsed,
        medium: parsed.mediumCode,
        attrs: {
          ...currentAttrs,
          medium: parsed.mediumCode,
          lineLabel: formatPipeLabel(parsed),
          DN: parsed.diameter,
          material: parsed.pressureCode,
          insulation: parsed.insulationCode,
        },
      });
      return;
    }

    currentAttrs.lineLabel = raw;
    onUpdateConnection(connection.id, {
      pipeLabel: undefined,
      attrs: currentAttrs,
      medium: connection.medium,
    });
  };

  const updatePipeField = (field: 'medium' | 'material' | 'insulation', value: string) => {
    const normalized = value.trim().toUpperCase();
    const currentAttrs = { ...(connection.attrs || {}) };
    if (!normalized) {
      delete currentAttrs[field];
    } else {
      currentAttrs[field] = normalized;
    }

    if (connection.pipeLabel) {
      const nextPipeLabel = { ...connection.pipeLabel } as PipeLabel;
      if (field === 'medium') nextPipeLabel.mediumCode = normalized;
      if (field === 'material') nextPipeLabel.pressureCode = normalized;
      if (field === 'insulation') nextPipeLabel.insulationCode = normalized;

      const isValid = isValidPipeLabelObject(nextPipeLabel);

      onUpdateConnection(connection.id, {
        pipeLabel: isValid ? nextPipeLabel : undefined,
        medium: normalized || connection.medium,
        attrs: {
          ...currentAttrs,
          lineLabel: isValid ? formatPipeLabel(nextPipeLabel) : currentAttrs.lineLabel,
          DN: currentAttrs.DN,
          material: currentAttrs.material,
          insulation: currentAttrs.insulation,
        },
      });
      return;
    }

    onUpdateConnection(connection.id, {
      medium: field === 'medium' ? (normalized || undefined) : connection.medium,
      attrs: currentAttrs,
    });
  };

  const updatePipeDn = (raw: string) => {
    const currentAttrs = { ...(connection.attrs || {}) };
    const nextDn = Number(raw);

    if (!raw) {
      delete currentAttrs.DN;
      onUpdateConnection(connection.id, {
        attrs: currentAttrs,
      });
      return;
    }

    if (Number.isNaN(nextDn)) {
      currentAttrs.DN = raw;
      onUpdateConnection(connection.id, { attrs: currentAttrs });
      return;
    }

    currentAttrs.DN = nextDn;

    if (connection.pipeLabel) {
      onUpdateConnection(connection.id, {
        pipeLabel: {
          ...connection.pipeLabel,
          diameter: nextDn,
        },
        attrs: {
          ...currentAttrs,
          lineLabel: formatPipeLabel({
            ...connection.pipeLabel,
            diameter: nextDn,
          }),
        },
      });
      return;
    }

    onUpdateConnection(connection.id, { attrs: currentAttrs });
  };

  const lineText = getCurrentLineText();
  const lineParsed = lineText ? parsePipeLabel(lineText) : null;
  const medium = normalizeText(connection.medium ?? connection.attrs?.medium);
  const material = normalizeText(connection.attrs?.material);
  const insulation = normalizeText(connection.attrs?.insulation);

  const mediumHasKnown = !!(medium && materialCodes.some((item) => item.code === medium));
  const materialHasKnown = !!(material && pipeMaterialSpecs.some((item) => item.code === material));
  const insulationHasKnown = !!(insulation && insulationCodes.some((item) => item.code === insulation));

  const dn =
    typeof connection.attrs?.DN === 'number'
      ? String(connection.attrs.DN)
      : typeof connection.attrs?.DN === 'string'
        ? String(connection.attrs.DN)
        : '';

  const getConnectionAttrLabel = (key: string) => {
    const zhLabelMap: Record<string, string> = {
      equipmentCode: '设备代号',
      equipmentName: '设备名称',
      medium: '介质',
      material: '管道等级',
      insulation: '隔热',
      DN: '公称直径',
      design_pressure: '设计压力',
      design_temperature: '设计温度',
      volume: '容积',
      agitator: '搅拌器',
      agitato: '搅拌器',
      valveType: '阀门类型',
      processType: '工艺类型',
      process_class: '工艺级别',
    };
    const enLabelMap: Record<string, string> = {
      equipmentCode: 'Equipment Code',
      equipmentName: 'Equipment Name',
      medium: 'Medium',
      material: 'Pipe Grade',
      insulation: 'Insulation',
      DN: 'DN',
      design_pressure: 'Design Pressure',
      design_temperature: 'Design Temperature',
      volume: 'Volume',
      agitator: 'Agitator',
      agitato: 'Agitator',
      valveType: 'Valve Type',
      processType: 'Process Type',
      process_class: 'Process Class',
    };
    return displayMode === 'zh' ? (zhLabelMap[key] || key) : (enLabelMap[key] || key);
  };

  const renderDictInput = (
    label: string,
    value: string,
    codes: { code: string; zh: string }[],
    hasKnown: boolean,
    onSelectKnown: (value: string) => void,
    onCustom: (value: string) => void,
  ) => {
    const customRowLabel = t(`${label}自定义`, `Custom ${label}`);
    return (
      <>
        <FieldRow label={label}>
          <select
            value={hasKnown ? value : '__CUSTOM__'}
            onChange={(e) => {
              const next = e.target.value;
              if (next === '__CUSTOM__') {
                onSelectKnown('');
              } else {
                onSelectKnown(next);
              }
            }}
            style={inputStyle}
          >
            <option value="__CUSTOM__">{t('自定义', 'Custom')}</option>
            {codes.map((code) => (
              <option key={code.code} value={code.code}>
                {code.code} - {code.zh}
              </option>
            ))}
          </select>
        </FieldRow>
        {(!hasKnown || !value) && (
          <FieldRow label={customRowLabel}>
            <TextInput
              value={value}
              onValueChange={onCustom}
              placeholder={t(`请输入${label}`, `Custom ${label}`)}
              style={inputStyle}
            />
          </FieldRow>
        )}
      </>
    );
  };

  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>🔗 {connection.id}</h3>

      <FieldRow label={t('类型', 'Type')}>
        <select
          value={connection.kind}
          onChange={(e) => onUpdateConnection(connection.id, { kind: e.target.value as ConnectionKind })}
          style={inputStyle}
        >
          <option value="pipe">{t('管道', 'Pipe')}</option>
          <option value="signal">{t('信号', 'Signal')}</option>
          <option value="cable">{t('电缆', 'Cable')}</option>
        </select>
      </FieldRow>

      <FieldRow label={t('从', 'From')}>
        <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{connection.from}</span>
      </FieldRow>
      <FieldRow label={t('到', 'To')}>
        <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{connection.to}</span>
      </FieldRow>

      <FieldRow label={t('中文名', 'Chinese Name')}>
        <TextInput
          value={connection.label?.zh || ''}
          onValueChange={(value) => onUpdateConnection(connection.id, { label: { ...connection.label, zh: value } })}
          style={inputStyle}
        />
      </FieldRow>
      <FieldRow label={t('英文名', 'English Name')}>
        <TextInput
          value={connection.label?.en || ''}
          onValueChange={(value) => onUpdateConnection(connection.id, { label: { ...connection.label, en: value } })}
          style={inputStyle}
        />
      </FieldRow>

      <h4 style={{ margin: '12px 0 4px', fontSize: 12, color: '#666' }}>{t('属性', 'Attributes')}</h4>
      {connection.kind === 'pipe' && (
        <>
          <FieldRow label={t('管线编号', 'Line ID')}>
            <TextInput
              value={lineText}
              onValueChange={setLineLabel}
              placeholder={t('例: PG-V1101-01-50-M1B-H50', 'e.g. PG-V1101-01-50-M1B-H50')}
              style={inputStyle}
            />
          </FieldRow>
          {lineText && !lineParsed && (
            <FieldRow label={t('提示', 'Hint')}>
              <span style={{ fontSize: 11, color: '#e67e22' }}>{t('当前输入的管线编号不满足标准格式', 'The entered line ID does not match the standard format')}</span>
            </FieldRow>
          )}

          <FieldRow label="DN">
            <input
              type="number"
              value={dn}
              onChange={(e) => updatePipeDn(e.target.value)}
              placeholder={t('管径 DN', 'Pipe DN')}
              style={inputStyle}
            />
          </FieldRow>
          {renderDictInput(
            t('管道等级', 'Pipe Grade'),
            material,
            pipeMaterialSpecs,
            materialHasKnown,
            (next) => updatePipeField('material', next),
            (next) => updatePipeField('material', next),
          )}
          {renderDictInput(
            t('隔热', 'Insulation'),
            insulation,
            insulationCodes,
            insulationHasKnown,
            (next) => updatePipeField('insulation', next),
            (next) => updatePipeField('insulation', next),
          )}
          {renderDictInput(
            t('介质', 'Medium'),
            medium,
            materialCodes,
            mediumHasKnown,
            (next) => updatePipeField('medium', next),
            (next) => updatePipeField('medium', next),
          )}
        </>
      )}

      {connection.attrs && Object.entries(connection.attrs)
        .filter(([k]) => k !== 'DN' && k !== 'material' && k !== 'medium' && k !== 'insulation' && k !== 'lineLabel')
        .map(([k, v]) => (
          <FieldRow key={k} label={getConnectionAttrLabel(k)}>
            <TextInput value={String(v ?? '')} onValueChange={(value) => updateAttr(k, value)} style={inputStyle} />
          </FieldRow>
        ))}
    </div>
  );
}

// --- Annotation Editor ---

function AnnotationEditor({
  annotation,
  displayMode,
  onUpdateAnnotation,
  onDeleteAnnotation,
}: {
  annotation: Annotation;
  displayMode: DisplayMode;
  onUpdateAnnotation: (annId: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
}) {
  const t = (zh: string, en: string) => (displayMode === 'zh' ? zh : en);
  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>📝 {annotation.id}</h3>

      <FieldRow label={t('中文', 'Chinese')}>
        <TextInput
          value={annotation.text?.zh || ''}
          onValueChange={(value) => onUpdateAnnotation(annotation.id, { text: { ...annotation.text, zh: value } })}
          style={inputStyle}
        />
      </FieldRow>
      <FieldRow label={t('英文', 'English')}>
        <TextInput
          value={annotation.text?.en || ''}
          onValueChange={(value) => onUpdateAnnotation(annotation.id, { text: { ...annotation.text, en: value } })}
          style={inputStyle}
        />
      </FieldRow>
      <FieldRow label={t('关联', 'Reference')}>
        <TextInput
          value={annotation.target || ''}
          onValueChange={(value) => onUpdateAnnotation(annotation.id, { target: value || undefined })}
          placeholder={t('设备/连接 ID', 'Unit/Connection ID')}
          style={inputStyle}
        />
      </FieldRow>

      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => onDeleteAnnotation(annotation.id)}
          style={{ ...btnStyle, color: '#e74c3c', borderColor: '#e74c3c' }}
        >
          {t('删除此注释', 'Delete Annotation')}
        </button>
      </div>
    </div>
  );
}

// --- Shared components ---

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
      <span style={{ width: 76, fontSize: 12, color: '#555', flexShrink: 0, fontWeight: 500 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

type TextInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Text input that preserves IME composition (Chinese/Japanese/Korean input).
 * It keeps a local draft while the input method is composing, and only commits
 * to the global project model after composition ends. This prevents ReactFlow
 * project → nodes/edges refreshes from cancelling the OS candidate popup.
 */
function TextInput({ value, onValueChange, onCompositionStart, onCompositionEnd, onBlur, ...props }: TextInputProps) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current && !composingRef.current) {
      setDraft(value);
    }
  }, [value]);

  const commit = (nextValue: string) => {
    if (nextValue !== value) onValueChange(nextValue);
  };

  return (
    <input
      {...props}
      value={draft}
      onFocus={(e) => {
        focusedRef.current = true;
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        const nextValue = e.target.value;
        setDraft(nextValue);
        const nativeEvent = e.nativeEvent as InputEvent;
        if (!composingRef.current && !nativeEvent.isComposing) {
          commit(nextValue);
        }
      }}
      onCompositionStart={(e) => {
        composingRef.current = true;
        onCompositionStart?.(e);
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        const nextValue = e.currentTarget.value;
        setDraft(nextValue);
        commit(nextValue);
        onCompositionEnd?.(e);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        composingRef.current = false;
        commit(e.currentTarget.value);
        onBlur?.(e);
      }}
    />
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  border: '1px solid #d0d0d0',
  borderRadius: 4,
  fontSize: 13,
  boxSizing: 'border-box',
  lineHeight: '1.4',
};

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 12,
};

const deleteBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#e74c3c',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 'bold',
  lineHeight: 1,
  padding: '0 4px',
};
