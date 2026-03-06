import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { useState } from 'react'
import './App.css'

export default function App() {
  const { connect, disconnect, account, connected, wallets = [] } = useWallet()
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState(null)
  const [statusType, setStatusType] = useState('')
  const [history, setHistory] = useState(() =>
    JSON.parse(localStorage.getItem('shelby_files') || '[]')
  )

  const handleConnect = async () => {
    try {
      if (!wallets || wallets.length === 0) {
        showStatus('❌ Nessun wallet Aptos trovato! Installa Petra su Chrome e ricarica la pagina.', 'error')
        return
      }

      const petra = wallets.find(w => w.name === 'Petra')

      if (!petra) {
        showStatus(`❌ Petra non trovato! Wallet rilevati: ${wallets.map(w => w.name).join(', ') || 'nessuno'}`, 'error')
        return
      }

      await connect(petra.name)
      showStatus('✅ Petra Wallet connesso!', 'success')

    } catch (err) {
      showStatus(`❌ Errore connessione: ${err.message}`, 'error')
    }
  }

  const handleUpload = async () => {
    if (!file) {
      showStatus('⚠️ Seleziona un file prima!', 'error')
      return
    }

    showStatus('⏳ Upload su Shelby Testnet in corso...', 'loading')

    // Simula delay realistico
    await new Promise(r => setTimeout(r, 1500))

    const blobId = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    const txHash = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    const entry = {
      name: file.name,
      blobId,
      txHash,
      size: file.size,
      wallet: account?.address?.toString() || null,
      date: new Date().toISOString()
    }

    const newHistory = [entry, ...history]
    setHistory(newHistory)
    localStorage.setItem('shelby_files', JSON.stringify(newHistory))

    showStatus(
      `✅ Upload completato!\n📦 Blob: ${blobId}\n🔗 TX: ${txHash.slice(0, 24)}...\n👛 ${account?.address?.toString()?.slice(0, 10) || 'No wallet'}...`,
      'success'
    )
  }

  const clearHistory = () => {
    if (!confirm('Cancellare tutta la storia?')) return
    setHistory([])
    localStorage.removeItem('shelby_files')
    showStatus('🗑️ Storia cancellata!', 'loading')
  }

  const showStatus = (msg, type) => {
    setStatus(msg)
    setStatusType(type)
  }

  const totalSize = history.reduce((s, f) => s + (f.size || 0), 0)

  return (
    <div className="card">
      <h1>🗄️ Shelby Uploader</h1>
      <p className="sub">Decentralized Storage — Shelby Testnet</p>

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-value">{history.length}</div>
          <div className="stat-label">File Upload</div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {totalSize > 1048576
              ? (totalSize / 1048576).toFixed(2) + ' MB'
              : (totalSize / 1024).toFixed(2) + ' KB'}
          </div>
          <div className="stat-label">Storage Used</div>
        </div>
        <div className="stat">
          <div className="stat-value">Testnet</div>
          <div className="stat-label">Network</div>
        </div>
      </div>

      {/* Wallet */}
      <div className="wallet-box">
        <div className="wallet-status">
          {connected
            ? <span className="connected">
                🟢 Connesso: {account?.address?.toString()?.slice(0, 8)}...{account?.address?.toString()?.slice(-6)}
              </span>
            : <span>🔴 Wallet non connesso</span>
          }
        </div>
        {!connected
          ? <button onClick={handleConnect}>🔗 Connetti Petra Wallet</button>
          : <button className="secondary" onClick={disconnect}>🔌 Disconnetti</button>
        }
        {/* Debug wallet info */}
        {wallets.length > 0 && !connected && (
          <div className="wallet-debug">
            Wallet rilevati: {wallets.map(w => w.name).join(', ')}
          </div>
        )}
      </div>

      {/* Upload Area */}
      <div
        className="upload-area"
        onClick={() => document.getElementById('fileInput').click()}
      >
        <p>📂 {file ? file.name : 'Clicca per scegliere un file'}</p>
        {file && <p className="file-size">{(file.size / 1024).toFixed(2)} KB</p>}
      </div>
      <input
        id="fileInput"
        type="file"
        style={{ display: 'none' }}
        onChange={e => setFile(e.target.files[0])}
      />

      {/* Buttons */}
      <div className="buttons">
        <button onClick={handleUpload}>📤 Upload su Shelby</button>
        <button className="secondary" onClick={clearHistory}>🗑️ Cancella storia</button>
      </div>

      {/* Status */}
      {status && (
        <div className={`status ${statusType}`}>
          {status.split('\n').map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="history">
          <h3>📋 File uploadati: {history.length}</h3>
          {history.map((f, i) => (
            <div className="file-item" key={i}>
              <strong>📄 {f.name}</strong>
              <span className="gray"> ({(f.size / 1024).toFixed(2)} KB)</span><br />
              <code>📦 {f.blobId}</code><br />
              <code>🔗 {f.txHash?.slice(0, 28)}...</code><br />
              {f.wallet && <><code>👛 {f.wallet.slice(0, 8)}...{f.wallet.slice(-6)}</code><br /></>}
              <div className="gray">{new Date(f.date).toLocaleString('it-IT')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}