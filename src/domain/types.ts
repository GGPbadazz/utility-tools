import type { PipeLabel } from './piping';

export type DisplayMode = 'zh' | 'en';
export type UnitType = 'vessel' | 'pump' | 'valve' | 'instrument' | 'junction' | 'custom';
export type ConnectionKind = 'pipe' | 'signal' | 'cable';
export type PortSide = 'left' | 'right' | 'top' | 'bottom';
export type PortDirection = 'input' | 'output' | 'bidirectional';

export type LocalizedLabel = {
  zh?: string;
  en?: string;
};

export type LayoutData = {
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type Port = {
  id?: string;
  uid?: string;
  kind: ConnectionKind;
  direction?: PortDirection;
  label?: LocalizedLabel;
  DN?: number;
  side?: PortSide;
  attrs?: Record<string, unknown>;
};

export type Unit = {
  id?: string;
  type: UnitType;
  customType?: string;
  label: LocalizedLabel;
  aliases?: string[];
  attrs?: Record<string, unknown>;
  ports?: Record<string, Port>;
  layout?: LayoutData;
};

export type Connection = {
  id: string;
  kind: ConnectionKind;
  from: string;
  to: string;
  pipeLabel?: PipeLabel;
  medium?: string;
  label?: LocalizedLabel;
  attrs?: Record<string, unknown>;
};

export type Annotation = {
  id: string;
  target?: string;
  text: LocalizedLabel;
  layout: LayoutData;
};

export type ProjectModel = {
  project: {
    id: string;
    name?: LocalizedLabel;
    language?: string;
    version?: string;
  };
  units: Record<string, Unit>;
  connections: Connection[];
  annotations?: Annotation[];
};

export type ValidationIssue = {
  level: 'error' | 'warning';
  message: string;
  path?: string;
};
