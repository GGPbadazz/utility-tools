#!/usr/bin/env python3
"""Extract connection relations from a DXF multi-sheet logic diagram.

This script:
1) identifies sheet blocks by A1E图框 inserts,
2) builds a node graph from line-like geometry,
3) infers symbol ports from block internals,
4) connects symbols to pipe nodes by geometric proximity.

Usage:
  python3 scripts/extract_dxf_connections.py docs/...dxf --sheets 3 --tol 2.5
"""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Dict, List, Tuple

try:
    import ezdxf
    from ezdxf.math import Vec3
except Exception as exc:
    raise SystemExit("请先安装 ezdxf: python3 -m pip install --user ezdxf") from exc

Point = Tuple[float, float]


def arc_endpoints(ent) -> Tuple[Point, Point]:
    c = (float(ent.dxf.center.x), float(ent.dxf.center.y))
    r = float(ent.dxf.radius)
    a1 = math.radians(float(ent.dxf.start_angle))
    a2 = math.radians(float(ent.dxf.end_angle))
    return (
        (c[0] + r * math.cos(a1), c[1] + r * math.sin(a1)),
        (c[0] + r * math.cos(a2), c[1] + r * math.sin(a2)),
    )


def polyline_segments(ent) -> List[Tuple[Point, Point]]:
    pts = [(float(x), float(y)) for x, y, *_ in ent.get_points("xy")]
    segs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    if bool(getattr(ent, "closed", False)) and len(pts) > 2:
        segs.append((pts[-1], pts[0]))
    return segs


def entity_segments(ent) -> List[Tuple[Point, Point]]:
    t = ent.dxftype()
    if t == "LINE":
        return [
            (
                (float(ent.dxf.start.x), float(ent.dxf.start.y)),
                (float(ent.dxf.end.x), float(ent.dxf.end.y)),
            )
        ]
    if t in ("LWPOLYLINE", "POLYLINE"):
        return polyline_segments(ent)
    if t == "ARC":
        a, b = arc_endpoints(ent)
        return [(a, b)]
    if t == "CIRCLE":
        c = (float(ent.dxf.center.x), float(ent.dxf.center.y))
        r = float(ent.dxf.radius)
        return [((c[0] - r, c[1]), (c[0] + r, c[1]))]
    return []


class NodeMap:
    def __init__(self, tol: float):
        self.tol = tol
        self.bucket_size = tol * 2.0
        self.buckets: Dict[Tuple[int, int], List[int]] = defaultdict(list)
        self.points: List[Point] = []

    def _bucket(self, p: Point) -> Tuple[int, int]:
        return (round(p[0] / self.bucket_size), round(p[1] / self.bucket_size))

    def add_or_get(self, p: Point) -> int:
        bx, by = self._bucket(p)
        for ix in (bx - 1, bx, bx + 1):
            for iy in (by - 1, by, by + 1):
                for idx in self.buckets.get((ix, iy), []):
                    ox, oy = self.points[idx]
                    if (ox - p[0]) ** 2 + (oy - p[1]) ** 2 <= self.tol * self.tol:
                        return idx
        idx = len(self.points)
        self.points.append((float(p[0]), float(p[1])))
        self.buckets[(bx, by)].append(idx)
        return idx


def in_sheet(p: Point, rect: Tuple[float, float, float, float], pad: float = 5.0) -> bool:
    x, y = p
    xmin, xmax, ymin, ymax = rect
    return xmin - pad <= x <= xmax + pad and ymin - pad <= y <= ymax + pad


def infer_block_ports(block, tol: float = 0.8) -> List[Point]:
    segments: List[Tuple[Point, Point]] = []
    for ent in block:
        segments.extend(entity_segments(ent))

    if not segments:
        return []

    nm = NodeMap(tol)
    degree: Dict[int, int] = defaultdict(int)
    for a, b in segments:
        ia = nm.add_or_get(a)
        ib = nm.add_or_get(b)
        degree[ia] += 1
        degree[ib] += 1

    xs = [p[0] for p in nm.points]
    ys = [p[1] for p in nm.points]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    bw = maxx - minx
    bh = maxy - miny
    margin_x = max(0.08 * bw, 0.5)
    margin_y = max(0.08 * bh, 0.5)

    candidates: List[Point] = []
    for i, p in enumerate(nm.points):
        x, y = p
        boundary = x <= minx + margin_x or x >= maxx - margin_x or y <= miny + margin_y or y >= maxy - margin_y
        if degree[i] == 1 and boundary:
            candidates.append(p)

    if not candidates:
        for i, p in enumerate(nm.points):
            x, y = p
            boundary = x <= minx + margin_x or x >= maxx - margin_x or y <= miny + margin_y or y >= maxy - margin_y
            if degree[i] <= 2 and boundary:
                candidates.append(p)

    dedup = NodeMap(tol)
    out: List[Point] = []
    for p in candidates:
        i = dedup.add_or_get(p)
        if i == len(dedup.points) - 1:
            out.append(p)
    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("dxf", type=Path, help="DXF 文件路径")
    parser.add_argument("--sheets", type=int, default=3, help="提取前 N 张图，默认 3")
    parser.add_argument("--tol", type=float, default=2.5, help="几何节点聚合容差")
    parser.add_argument("--port-tol", type=float, default=0.8, help="符号端口聚合容差")
    parser.add_argument("--port-link-tol", type=float, default=6.0, help="端口到管线节点的连接容差")
    parser.add_argument("--out", type=Path, default=None, help="可选：导出 JSON 结果")
    return parser.parse_args()


def build_sheet_rects(doc, count: int, name: str = "A1E图框") -> List[Tuple[float, float, float, float]]:
    msp = doc.modelspace()
    frame_inserts = sorted(
        (e for e in msp if e.dxftype() == "INSERT" and e.dxf.name == name),
        key=lambda e: e.dxf.insert.x,
    )[:count]

    if not frame_inserts:
        raise RuntimeError("未找到 A1E图框 插入块")

    frame = doc.blocks.get(name)
    all_pts: List[Point] = []
    for ent in frame:
        all_pts.extend([p for seg in entity_segments(ent) for p in seg])
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    w, h = (max(xs) - min(xs), max(ys) - min(ys))

    rects = []
    for f in frame_inserts:
        x, y = float(f.dxf.insert.x), float(f.dxf.insert.y)
        rects.append((x, x + w, y, y + h))
    return rects


def build_ports_cache(doc, port_tol: float) -> Dict[str, List[Point]]:
    cache: Dict[str, List[Point]] = {}
    for b in doc.blocks:
        if b.name.startswith("*") or b.name == "A1E图框":
            continue
        cache[b.name] = infer_block_ports(b, tol=port_tol)
    return cache


def extract(doc, sheet_rects: List[Tuple[float, float, float, float]], tol: float, port_cache: Dict[str, List[Point]],
            port_link_tol: float) -> Dict:
    msp = doc.modelspace()
    results = []

    for idx, rect in enumerate(sheet_rects, start=1):
        node_map = NodeMap(tol)
        edges = []

        for ent in msp:
            if ent.dxftype() not in {"LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE"}:
                continue
            for p0, p1 in entity_segments(ent):
                if not in_sheet(p0, rect, 3.0) and not in_sheet(p1, rect, 3.0):
                    continue
                n0 = node_map.add_or_get(p0)
                n1 = node_map.add_or_get(p1)
                edges.append({
                    "id": str(ent.dxf.handle),
                    "type": ent.dxftype(),
                    "n1": n0,
                    "n2": n1,
                })

        degree = defaultdict(int)
        adj: Dict[int, List[int]] = defaultdict(list)
        for e in edges:
            n1, n2 = e["n1"], e["n2"]
            degree[n1] += 1
            degree[n2] += 1
            adj[n1].append(n2)
            adj[n2].append(n1)

        symbols = []
        for ent in msp:
            if ent.dxftype() != "INSERT" or ent.dxf.name == "A1E图框":
                continue
            ins = (float(ent.dxf.insert.x), float(ent.dxf.insert.y))
            if not in_sheet(ins, rect, 40.0):
                continue
            local_ports = port_cache.get(ent.dxf.name, [])
            if not local_ports:
                continue

            M = ent.matrix44()
            world_ports = []
            for p in local_ports:
                wp = M.transform(Vec3(p[0], p[1], 0.0))
                world_ports.append((float(wp.x), float(wp.y)))

            linked_nodes = set()
            for wp in world_ports:
                best_idx = None
                best_d2 = port_link_tol * port_link_tol + 1e-9
                for ni, pn in enumerate(node_map.points):
                    d2 = (pn[0] - wp[0]) ** 2 + (pn[1] - wp[1]) ** 2
                    if d2 < best_d2:
                        best_idx = ni
                        best_d2 = d2
                if best_idx is not None:
                    linked_nodes.add(best_idx)

            if linked_nodes:
                symbols.append({
                    "block": ent.dxf.name,
                    "handle": str(ent.dxf.handle),
                    "nodes": sorted(linked_nodes),
                    "insert": ins,
                })

        # connected components
        comp_id = {}
        comp_stats = []
        for n in range(len(node_map.points)):
            if n in comp_id or n not in adj:
                continue
            q = deque([n])
            comp_id[n] = len(comp_stats)
            members = []
            while q:
                u = q.popleft()
                members.append(u)
                for v in adj[u]:
                    if v not in comp_id:
                        comp_id[v] = comp_id[n]
                        q.append(v)
            comp_stats.append({"nodes": len(members), "sample_nodes": members[:6]})

        junctions = [
            {
                "id": n,
                "degree": degree[n],
                "point": node_map.points[n],
            }
            for n in range(len(node_map.points))
            if degree[n] >= 3
        ]

        results.append({
            "sheet": idx,
            "rect": rect,
            "node_count": len(node_map.points),
            "edge_count": len(edges),
            "junction_count": len(junctions),
            "endpoint_count": sum(1 for n in range(len(node_map.points)) if degree[n] == 1),
            "symbols_connected": len(symbols),
            "top_symbols": Counter(s["block"] for s in symbols).most_common(8),
            "junctions": junctions[:20],
            "symbols": symbols[:120],
            "components": sorted(comp_stats, key=lambda x: x["nodes"], reverse=True)[:12],
        })

    return {"sheets": results}


def main() -> None:
    args = parse_args()
    doc = ezdxf.readfile(str(args.dxf))

    sheet_rects = build_sheet_rects(doc, args.sheets)
    port_cache = build_ports_cache(doc, args.port_tol)
    result = extract(doc, sheet_rects, args.tol, port_cache, args.port_link_tol)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"已导出: {args.out}")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
