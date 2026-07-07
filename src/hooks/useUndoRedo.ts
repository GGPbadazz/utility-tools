import { useState, useCallback, useRef } from 'react';
import type { ProjectModel } from '../domain/types';

const MAX_HISTORY = 50;

export function useUndoRedo(initial: ProjectModel) {
  const [project, setProjectRaw] = useState<ProjectModel>(initial);
  const pastRef = useRef<ProjectModel[]>([]);
  const futureRef = useRef<ProjectModel[]>([]);

  const setProject: React.Dispatch<React.SetStateAction<ProjectModel>> = useCallback((action) => {
    setProjectRaw((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next === prev) return prev;
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), prev];
      futureRef.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setProjectRaw((prev) => {
      if (pastRef.current.length === 0) return prev;
      const previous = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [...futureRef.current, prev];
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setProjectRaw((prev) => {
      if (futureRef.current.length === 0) return prev;
      const next = futureRef.current[futureRef.current.length - 1];
      futureRef.current = futureRef.current.slice(0, -1);
      pastRef.current = [...pastRef.current, prev];
      return next;
    });
  }, []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return { project, setProject, undo, redo, canUndo, canRedo };
}
