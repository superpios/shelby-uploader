import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { useState, useEffect } from 'react'
import './App.css'

const SHELBY_API = 'https://api.shelbynet.shelby.xyz/shelby'
const SHELBY_EXPLORER = 'https://explorer.shelby.xyz/shelbynet'
const APTOS_API = 'https://api.shelbynet.shelby.xyz/v1'
const MY_ADDRESS = '0x827e4a0f14b99bafe739f685b5dba1863059e29b0f1711d38302ae8f384fabc1'

// ─── STORAGE HELPERS ───────────────────────────────────────────────
// Chiave unica per wallet — ogni address ha il suo storico separato
const storageKey = (addr) => `shelby_files_${addr || 'guest'}`

const loadHistory = (addr) => {
  try { return JSON.parse(localStorage.getItem(storageKey(addr)) || '[]') } catch { return [] }
}

const saveHistory = (addr, history) => {
  try { localStorage.setItem(storageKey(addr), JSON.stringify(history)) } catch {}
  // TODO: quando arriva API key → salvare anche su Shelby come blob JSON
  // const blob = new Blob([JSON.stringify(history)], { type: 'application/json' })
  // await fetch(`${SHELBY_API}/blobs/history-${addr}.json`, { method: 'PUT', body: blob, headers: { 'X-API-Key': API_KEY } })
}
// ───────────────────────────────────────────────────────────────────

export default function App() {
  const { connect, disconnect, account, connected, wallets = [] } = useWallet()
  const [tab, setTab] = useState('upload')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState(null)
  const [statusType, setStatusType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Swap state
  const [balanceAPT, setBalanceAPT] = useState(null)
  const [balanceSUSD, setBalanceSUSD] = useState(null)
  const [swapFrom, setSwapFrom] = useState('APT')
  const [swapAmount, setSwapAmount] = useState('')
  const [swapStatus, setSwapStatus] = useState(null)
  const [swapStatusType, setSwapStatusType] = useState('')
  const [loadingBalance, setLoadingBalance] = useState(false)

  const walletAddr = account?.address?.toString()

  // ── Carica storico quando cambia wallet ──────────────────────────
  useEffect(() => {
    if (!walletAddr) return
    const h = loadHistory(walletAddr)
    setHistory(h)
    if (h.length > 0) {
      showStatus(`📂 Caricati ${h.length} file dal tuo storico`, 'success')
    }
  }, [walletAddr])

  useEffect(() => {
    if (!connected) setHistory([])
  }, [connected])

  // ── Fetch balance quando apre tab swap ───────────────────────────
  useEffect(() => {
    if (connected && walletAddr && tab === 'swap') fetchBalances()
  }, [connected, walletAddr, tab])

  const fetchBalances = async () => {
    setLoadingBalance(true)
    try {
      const resp = await fetch(`${APTOS_API}/accounts/${walletAddr}/resources`)
      if (resp.ok) {
        const resources = await resp.json()
        const aptRes = resources.find(r => r.type === '0x1:🪙:CoinStore<0x1::aptos_coin::AptosCoin>')
        if (aptRes) setBalanceAPT((parseInt(aptRes.data.coin.value) / 1e8).toFixed(4))
        const susdRes = resources.find(r => r.type?.includes('ShelbyUSD') || r.type?.includes('shelby_usd'))
        if (susdRes) setBalanceSUSD((parseInt(susdRes.data.coin?.value || 0) / 1e8).toFixed(4))
      }
    } catch (e) {}
    setLoadingBalance(false)
  }

  const handleConnect = async () => {
    try {
      if (!wallets || wallets.length === 0) {
        showStatus('❌ Nessun wallet trovato! Installa Petra su Chrome e ricarica.', 'error'); return
      }
      const petra = wallets.find(w => w.name === 'Petra')
      if (!petra) { showStatus('❌ Petra non trovato!', 'error'); return }
      await connect(petra.name)
      showStatus('✅ Petra Wallet connesso!', 'success')
    } catch (err) { showStatus(`❌ Errore: ${err.message}`, 'error') }
  }

  const handleUpload = async () => {
    if (!file) { showStatus('⚠️ Seleziona un file prima!', 'error'); return }

    setUploading(true); setProgress(0)
    showStatus('⏳ Connessione a Shelby Network...', 'loading')

    const interval = setInterval(() => setProgress(p => p < 85 ? p + Math.random() * 10 : p), 200)

    let blobId = null, txHash = null, isReal = false
    try {
      const headers = { 'Content-Type': file.type || 'application/octet-stream' }
      if (walletAddr) headers['X-Wallet-Address'] = walletAddr
      const resp = await fetch(`${SHELBY_API}/blobs/${encodeURIComponent(Date.now()+'-'+file.name)}`, {
        method: 'PUT', headers, body: file
      })
      if (resp.ok) {
        const data = await resp.json().catch(() => ({}))
        blobId = data.blobId || data.blob_id || data.id
        txHash = data.txHash || data.tx_hash
        isReal = true
      }
    } catch (e) {}

    if (!blobId) {
      blobId = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2,'0')).join('')
      txHash = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,'0')).join('')
    }

    clearInterval(interval); setProgress(100)

    const entry = {
      name: file.name, blobId, txHash, size: file.size,
      wallet: walletAddr || null,
      date: new Date().toISOString(), isReal,
      explorerUrl: `${SHELBY_EXPLORER}/account/${walletAddr || MY_ADDRESS}`
    }

    const newHistory = [entry, ...history]
    setHistory(newHistory)
    saveHistory(walletAddr, newHistory)  // ← salva per questo wallet specifico

    setTimeout(() => {
      setUploading(false); setProgress(0)
      showStatus(`✅ Upload ${isReal ? 'REALE ✨' : 'simulato'} completato!\n📦 Blob: ${blobId}\n🔗 TX: ${txHash.slice(0,24)}...\n👛 ${walletAddr?.slice(0,10) || 'guest'}...`, 'success')
    }, 500)
  }

  const clearHistory = () => {
    if (!confirm('Cancellare tutta la storia di questo wallet?')) return
    setHistory([])
    saveHistory(walletAddr, [])
    showStatus('🗑️ Storia cancellata!', 'loading')
  }

  const handleSwap = async () => {
    if (!connected) { setSwapStatus('❌ Connetti prima il wallet!'); setSwapStatusType('error'); return }
    if (!swapAmount || isNaN(swapAmount) || parseFloat(swapAmount) <= 0) {
      setSwapStatus('⚠️ Inserisci un importo valido!'); setSwapStatusType('error'); return
    }
    setSwapStatus('⏳ Swap in corso...'); setSwapStatusType('loading')
    await new Promise(r => setTimeout(r, 1500))
    const toToken = swapFrom === 'APT' ? 'ShelbyUSD' : 'APT'
    setSwapStatus(`✅ Swap simulato!\n${swapAmount} ${swapFrom} → ${swapAmount} ${toToken}\n⚠️ Swap reale disponibile al lancio mainnet`)
    setSwapStatusType('success')
    setSwapAmount('')
  }

  const showStatus = (msg, type) => { setStatus(msg); setStatusType(type) }
  const totalSize = history.reduce((s, f) => s + (f.size || 0), 0)
  const swapTo = swapFrom === 'APT' ? 'ShelbyUSD' : 'APT'

  return (
    <div className="card">
      <h1>🗄️ Shelby Uploader</h1>
      <p className="sub">Decentralized Storage — Shelby Testnet</p>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>📤 Upload</button>
        <button className={`tab-btn ${tab === 'swap' ? 'active' : ''}`} onClick={() => setTab('swap')}>🔄 Swap</button>
      </div>

      {/* Wallet Box */}
      <div className="wallet-box">
        <div className="wallet-status">
          {connected
            ? <span className="connected">🟢 {walletAddr?.slice(0,8)}...{walletAddr?.slice(-6)}</span>
            : <span>🔴 Wallet non connesso — lo storico non sarà salvato</span>
          }
        </div>
        <div>
          {!connected
            ? <button onClick={handleConnect}>🔗 Connetti Petra</button>
            : <button className="secondary" onClick={disconnect}>🔌 Disconnetti</button>
          }
          <a href={`${SHELBY_EXPLORER}/account/${walletAddr || MY_ADDRESS}`} target="_blank" rel="noreferrer" className="btn-explorer">🔍 Explorer</a>
        </div>
      </div>

      {/* TAB UPLOAD */}
      {tab === 'upload' && (
        <>
          <div className="stats">
            <div className="stat"><div className="stat-value">{history.length}</div><div className="stat-label">File Upload</div></div>
            <div className="stat">
              <div className="stat-value">{totalSize > 1048576 ? (totalSize/1048576).toFixed(2)+' MB' : (totalSize/1024).toFixed(2)+' KB'}</div>
              <div className="stat-label">Storage Used</div>
            </div>
            <div className="stat">
              <div className="stat-value">Shelbynet</div>
              <div className="stat-label">Network</div>
            </div>
          </div>

          <div className="upload-area" onClick={() => !uploading && document.getElementById('fileInput').click()}>
            <p>📂 {file ? file.name : 'Clicca per scegliere un file'}</p>
            {file && <p className="file-size">{(file.size/1024).toFixed(2)} KB</p>}
          </div>
          <input id="fileInput" type="file" style={{display:'none'}} onChange={e => setFile(e.target.files[0])} />

          {uploading && <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}} /></div>}

          <div className="buttons">
            <button onClick={handleUpload} disabled={uploading}>{uploading ? '⏳ Uploading...' : '📤 Upload su Shelby'}</button>
            <button className="secondary" onClick={() => setShowHistory(h => !h)}>
              📋 {showHistory ? 'Nascondi' : 'I miei file'} ({history.length})
            </button>
            <button className="danger" onClick={clearHistory}>🗑️</button>
          </div>

          {status && <div className={`status ${statusType}`}>{status.split('\n').map((l,i) => <div key={i}>{l}</div>)}</div>}

          {showHistory && (
            <div className="history">
              <h3>📋 File wallet {walletAddr ? `${walletAddr.slice(0,8)}...` : 'guest'}: {history.length}</h3>
              {history.length === 0
                ? <p className="gray" style={{textAlign:'center',marginTop:12}}>Nessun file ancora</p>
                : history.map((f, i) => (
                  <div className="file-item" key={i}>
                    <strong>#{history.length-i} 📄 {f.name}</strong>
                    <span className="gray"> ({(f.size/1024).toFixed(2)} KB)</span>
                    {f.isReal && <span className="badge-real"> ✅ REALE</span>}<br/>
                    <code>📦 {f.blobId}</code><br/>
                    <code>🔗 {f.txHash?.slice(0,28)}...</code><br/>
                    {f.wallet && <><code>👛 {f.wallet.slice(0,8)}...{f.wallet.slice(-6)}</code><br/></>}
                    <div className="file-footer">
                      <span className="gray">{new Date(f.date).toLocaleString('it-IT')}</span>
                      {f.explorerUrl && <a href={f.explorerUrl} target="_blank" rel="noreferrer" className="link-explorer">🔍 Explorer →</a>}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </>
      )}

      {/* TAB SWAP */}
      {tab === 'swap' && (
        <div className="swap-container">
          <div className="balance-box">
            <div className="balance-title">
              💰 Saldo Shelbynet
              <button className="btn-refresh" onClick={fetchBalances} disabled={loadingBalance}>{loadingBalance ? '⏳' : '🔄'}</button>
            </div>
            {!connected
              ? <p className="gray" style={{fontSize:13}}>Connetti il wallet per vedere il saldo</p>
              : <div className="balance-grid">
                  <div className="balance-item"><span className="balance-token">APT</span><span className="balance-amount">{balanceAPT ?? '—'}</span></div>
                  <div className="balance-item"><span className="balance-token">ShelbyUSD</span><span className="balance-amount">{balanceSUSD ?? '—'}</span></div>
                </div>
            }
          </div>

          <div className="swap-box">
            <div className="swap-title">🔄 Swap Testnet</div>
            <div className="swap-row">
              <div className="swap-token-box"><div className="swap-label">Da</div><div className="swap-token">{swapFrom}</div></div>
              <button className="btn-switch" onClick={() => setSwapFrom(t => t === 'APT' ? 'ShelbyUSD' : 'APT')}>⇄</button>
              <div className="swap-token-box"><div className="swap-label">A</div><div className="swap-token">{swapTo}</div></div>
            </div>
            <input className="swap-input" type="number" placeholder={`Importo in ${swapFrom}`} value={swapAmount} onChange={e => setSwapAmount(e.target.value)} />
            {swapAmount && <p className="swap-rate">≈ {swapAmount} {swapTo} (1:1 testnet)</p>}
            <button className="btn-swap" onClick={handleSwap}>🔄 Swap</button>
            {swapStatus && <div className={`status ${swapStatusType}`} style={{marginTop:12}}>{swapStatus.split('\n').map((l,i) => <div key={i}>{l}</div>)}</div>}
          </div>

          <div className="faucet-box">
            <div className="faucet-title">🚰 Faucet Shelbynet</div>
            <p className="gray" style={{fontSize:12,marginBottom:12}}>Ottieni token gratuiti per testare</p>
            <div className="faucet-btns">
              <a href="https://faucet.shelbynet.shelby.xyz" target="_blank" rel="noreferrer" className="faucet-btn">💧 APT Faucet</a>
              <a href="https://faucet.shelbynet.shelby.xyz" target="_blank" rel="noreferrer" className="faucet-btn susd">💵 ShelbyUSD Faucet</a>
            </div>
            <p className="swap-note">oppure via CLI: <code>shelby faucet --network shelbynet</code></p>
          </div>
        </div>
      )}
    </div>
  )
}