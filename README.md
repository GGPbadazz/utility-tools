# Logic Diagram Interactive

Interactive browser tool for modeling process-equipment logic diagrams with structured units, ports, pipes, cables, signals, annotations, validation, and YAML/CSV/semantic-graph export.

The app is intended for turning engineering connection knowledge into versionable structured data instead of keeping it only inside CAD geometry or free-form drawing text.

## Features

- Visual editing with React Flow.
- YAML import/export for version control.
- DSL import for compact connection descriptions.
- Structured unit, port, pipe, signal, and cable metadata.
- Engineering dictionaries for media, pipe specs, equipment codes, supports, and instrument letters.
- Validation for references, dictionaries, pipe labels, and engineering-field consistency.
- CSV and semantic graph export.
- DXF helper script for local extraction experiments.

## Run Locally

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

Run the test suite:

```bash
npm test
```

## Example Data

`examples/project.logic.yaml` is a fictional sample. It is safe to use as a template and does not contain real project drawings or customer data.

## Data Safety

Do not commit real CAD drawings, customer deliverables, extracted pipe lists, or generated project previews. The `.gitignore` excludes common raw and derived engineering files such as DXF/DWG, Excel/Word files, `pipe_names.csv`, and `page*_preview.logic.yaml`.

Before publishing updates, run a quick scan from the repository root:

```bash
rg -n "<your sensitive keywords or credential patterns>"
```
