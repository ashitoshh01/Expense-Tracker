import { Download, FileText, FileJson } from 'lucide-react'

export default function ExportSheet({ onExportCSV, onExportJSON, onClose }) {
  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Download size={24} />
        Export & Backup Data
      </div>
      <div className="export-options">
        <button className="export-option-btn" onClick={onExportCSV} type="button">
          <span className="export-option-icon"><FileText /></span>
          <span className="export-option-text">
            <div className="export-option-title">Export as CSV</div>
            <div className="export-option-sub">Spreadsheet compatible format</div>
          </span>
        </button>
        <button className="export-option-btn" onClick={onExportJSON} type="button">
          <span className="export-option-icon"><FileJson /></span>
          <span className="export-option-text">
            <div className="export-option-title">Export JSON Backup</div>
            <div className="export-option-sub">Full schema v2 backup for restore</div>
          </span>
        </button>
      </div>
    </div>
  )
}
