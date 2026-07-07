"""
Pipe Connectivity Tracer
========================
For every pipe tag (e.g. CW-P01001-50-CS), find which device it comes
FROM and goes TO by:

  1. Building a graph of all pipe-line segments (LINE + LWPOLYLINE on
     pipe-related layers), with endpoints snapped to a tolerance grid.
  2. Finding the segment closest to each pipe-tag TEXT position.
  3. BFS-expanding through the connected segment chain.
  4. Locating device INSERTs near the chain's terminal endpoints.

Output: pid_pipe_connectivity.csv  with columns
        from_device, pipe_tag, to_device, ... (+ diagnostics)
"""

import argparse
import csv, math, re
from pathlib import Path
from collections import defaultdict, deque

import ezdxf
from ezdxf import recover

WORK_DIR = Path(__file__).parent
DXF_FILE = WORK_DIR / "sample_pid.dxf"
OUT_CSV  = WORK_DIR / "pid_pipe_connectivity.csv"

PIPE_LAYER_KW = ["pipe","管","管道","line","process","工艺","pid","实线","介质",
                 "流程","物料","蒸汽","冷冻","排空"]
PIPE_TAG_RE   = re.compile(
    r"\b[A-Z]{2,5}-P\d{3,6}[A-Z]?\d?-\d{1,4}-[A-Z0-9]{2,6}(?:-[A-Z0-9]{2,6})?\b",
    re.I,
)
# Tolerances (drawing units ≈ mm based on coordinate scale ~thousands)
SNAP_TOL = 2.0          # endpoint snap grid
DEV_TOL  = 250.0        # device-to-endpoint match radius
TAG_TOL  = 1500.0       # tag-text to nearest pipe-segment search radius

# Block names to IGNORE as "devices" (frames, title blocks, labels, etc.)
IGNORE_BLOCK_RE = re.compile(
    r"(图框|图签|界区|DAIHAO|A\$|^C\d|^SW|^B\d|^yjg|箭头|标注)", re.I
)

def parse_args():
    parser = argparse.ArgumentParser(description="Trace likely from/to devices for pipe tags in a P&ID DXF.")
    parser.add_argument("dxf", nargs="?", default=str(DXF_FILE), help="Path to the DXF file to read.")
    parser.add_argument("-o", "--output", default=str(OUT_CSV), help="CSV output path.")
    return parser.parse_args()

def is_pipe_layer(name):
    n = (name or "").lower()
    return any(kw.lower() in n for kw in PIPE_LAYER_KW)

def clean_mtext(s):
    s = re.sub(r"\\[A-Za-z][^;]*;", "", s or "")
    return s.replace("\\P", " ").replace("{", "").replace("}", "").strip()

def snap(p):
    return (round(p[0] / SNAP_TOL) * SNAP_TOL,
            round(p[1] / SNAP_TOL) * SNAP_TOL)

def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def collect(doc):
    msp = doc.modelspace()
    segments = []   # list of (p1, p2, layer)
    devices  = []   # (name, x, y, layer)
    tags     = []   # (tag_text, x, y, layer)

    for e in msp:
        t = e.dxftype()
        layer = e.dxf.layer if e.dxf.hasattr("layer") else "0"

        # ---- devices ----
        if t == "INSERT":
            name = e.dxf.name or ""
            if IGNORE_BLOCK_RE.search(name):
                continue
            devices.append((name, e.dxf.insert.x, e.dxf.insert.y, layer))

        # ---- pipe segments ----
        elif t == "LINE" and is_pipe_layer(layer):
            segments.append(((e.dxf.start.x, e.dxf.start.y),
                             (e.dxf.end.x, e.dxf.end.y), layer))
        elif t == "LWPOLYLINE" and is_pipe_layer(layer):
            pts = [(p[0], p[1]) for p in e.get_points("xy")]
            for i in range(len(pts) - 1):
                segments.append((pts[i], pts[i+1], layer))

        # ---- tag texts ----
        elif t in ("TEXT", "MTEXT"):
            try:
                raw = e.dxf.text if t == "TEXT" else e.text
            except Exception:
                raw = ""
            txt = clean_mtext(raw)
            for m in PIPE_TAG_RE.finditer(txt):
                try:
                    ip = e.dxf.insert
                    tags.append((m.group(0).upper(), ip.x, ip.y, layer))
                except Exception:
                    pass

    return segments, devices, tags


def build_graph(segments):
    """Return node->set(neighbor_node), node->list(segment_idx), seg list as (nodeA,nodeB)."""
    adj = defaultdict(set)
    node_segs = defaultdict(list)
    seg_nodes = []  # (nodeA, nodeB)
    for i, (a, b, _layer) in enumerate(segments):
        na, nb = snap(a), snap(b)
        if na == nb:
            continue
        adj[na].add(nb)
        adj[nb].add(na)
        node_segs[na].append(i)
        node_segs[nb].append(i)
        seg_nodes.append((na, nb))
    return adj, node_segs, seg_nodes


def nearest_segment(point, segments, seg_nodes, max_radius=TAG_TOL):
    """Return index of segment whose midpoint is closest to point (within radius)."""
    best_i, best_d = -1, max_radius
    for i, ((ax, ay), (bx, by), _l) in enumerate(segments):
        if i >= len(seg_nodes):
            continue
        mx, my = (ax + bx) / 2.0, (ay + by) / 2.0
        d = math.hypot(point[0] - mx, point[1] - my)
        if d < best_d:
            best_d, best_i = d, i
    return best_i, best_d


def bfs_component(start_node, adj, node_limit=2000):
    """Return all nodes reachable from start_node."""
    seen = {start_node}
    q = deque([start_node])
    while q and len(seen) < node_limit:
        cur = q.popleft()
        for nb in adj[cur]:
            if nb not in seen:
                seen.add(nb)
                q.append(nb)
    return seen


def nearest_devices_to_nodes(nodes, devices, max_radius=DEV_TOL):
    """For each node, find closest device within radius. Return list of (dev_idx, node, distance)."""
    hits = []
    for n in nodes:
        best = (None, None, max_radius)
        for di, (_nm, dx, dy, _l) in enumerate(devices):
            d = math.hypot(n[0] - dx, n[1] - dy)
            if d < best[2]:
                best = (di, n, d)
        if best[0] is not None:
            hits.append(best)
    return hits


def pick_endpoints(nodes, adj):
    """Pick two 'extremity' nodes — leaf nodes (degree 1) farthest apart, or
    fall back to the geometric extremes of the node set."""
    leaves = [n for n in nodes if len(adj[n]) == 1]
    candidates = leaves if len(leaves) >= 2 else list(nodes)
    if len(candidates) < 2:
        return None, None
    # farthest pair (limit cost — sample up to 60 nodes)
    sample = candidates[:60]
    best = (0, sample[0], sample[1])
    for i in range(len(sample)):
        for j in range(i + 1, len(sample)):
            d = dist(sample[i], sample[j])
            if d > best[0]:
                best = (d, sample[i], sample[j])
    return best[1], best[2]


def trace(segments, devices, tags):
    adj, _node_segs, seg_nodes = build_graph(segments)
    rows = []
    for tag, tx, ty, _layer in tags:
        seg_i, seg_d = nearest_segment((tx, ty), segments, seg_nodes)
        if seg_i < 0:
            rows.append({"pipe_tag": tag, "from_device": "", "to_device": "",
                         "from_block": "", "to_block": "",
                         "note": f"no nearby pipe segment (>{TAG_TOL})"})
            continue
        nodeA, nodeB = seg_nodes[seg_i]
        component = bfs_component(nodeA, adj)
        epA, epB = pick_endpoints(component, adj)
        if epA is None:
            rows.append({"pipe_tag": tag, "from_device": "", "to_device": "",
                         "from_block": "", "to_block": "",
                         "note": "no extremities found"})
            continue
        hitsA = nearest_devices_to_nodes([epA], devices)
        hitsB = nearest_devices_to_nodes([epB], devices)
        # also widen: search all nodes for closest device, ranked
        all_hits = nearest_devices_to_nodes(component, devices)
        all_hits.sort(key=lambda h: h[2])
        # de-dup by device index, keep best two
        seen_dev = set()
        ranked = []
        for di, n, d in all_hits:
            if di in seen_dev: continue
            seen_dev.add(di)
            ranked.append((di, n, d))
        dev_a = hitsA[0] if hitsA else (ranked[0] if ranked else None)
        dev_b = hitsB[0] if hitsB else (ranked[1] if len(ranked) > 1 else None)

        def fmt(h):
            if not h: return ("", "")
            di, _n, _d = h
            nm, dx, dy, lyr = devices[di]
            return (nm, f"({dx:.0f},{dy:.0f})")

        a_name, a_xy = fmt(dev_a)
        b_name, b_xy = fmt(dev_b)
        rows.append({
            "from_device": a_name,
            "from_xy":     a_xy,
            "pipe_tag":    tag,
            "to_device":   b_name,
            "to_xy":       b_xy,
            "segments_in_chain": len(component),
            "tag_xy":      f"({tx:.0f},{ty:.0f})",
            "tag_to_seg_dist": f"{seg_d:.1f}",
            "note": "",
        })
    return rows


def main():
    args = parse_args()
    dxf_file = Path(args.dxf).expanduser()
    out_csv = Path(args.output).expanduser()
    if not dxf_file.exists():
        raise SystemExit(f"ERROR: {dxf_file} not found.")
    out_csv.parent.mkdir(parents=True, exist_ok=True)

    print(f"Loading {dxf_file.name} ...")
    doc, _aud = recover.readfile(str(dxf_file))
    segments, devices, tags = collect(doc)
    print(f"Pipe segments: {len(segments)}   Devices: {len(devices)}   Tags: {len(tags)}")
    rows = trace(segments, devices, tags)
    rows.sort(key=lambda r: r["pipe_tag"])
    fields = ["from_device", "from_xy", "pipe_tag", "to_device", "to_xy",
              "segments_in_chain", "tag_xy", "tag_to_seg_dist", "note"]
    with open(out_csv, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})
    print(f"Wrote {len(rows)} rows -> {out_csv}")
    print("\nPreview:")
    print(f"{'FROM':<22} {'PIPE TAG':<28} {'TO':<22}")
    for r in rows[:30]:
        print(f"{r['from_device'][:20]:<22} {r['pipe_tag']:<28} {r['to_device'][:20]:<22}")


if __name__ == "__main__":
    main()
