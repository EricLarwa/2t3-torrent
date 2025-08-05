class BitTorrentGUI {
    constructor() {
        this.torrentPath = null
        this.downloadPath = null
        this.initializeEventListeners()
    }

    initializeEventListeners() {
        document.getElementById('selectTorrent').addEventListener('click', this.selectTorrentFile.bind(this))
        document.getElementById('selectLocation').addEventListener('click', this.selectDownloadLocation.bind(this))
        document.getElementById('startDownload').addEventListener('click', this.startDownload.bind(this))
        
        // Listen for download progress
        window.electronAPI.onDownloadProgress((event, progress) => {
            this.updateProgress(progress)
        })
    }

    async selectTorrentFile() {
        try {
            const filePath = await window.electronAPI.selectTorrentFile()
            if (filePath) {
                this.torrentPath = filePath
                document.getElementById('selectedFile').textContent = `Selected: ${filePath.split('\\').pop()}`
                document.getElementById('selectLocation').disabled = false
                this.addLogEntry(`Torrent file selected: ${filePath}`, 'info')
            }
        } catch (error) {
            this.addLogEntry(`Error selecting torrent: ${error.message}`, 'error')
        }
    }

    async selectDownloadLocation() {
        try {
            const folderPath = await window.electronAPI.selectDownloadLocation()
            if (folderPath) {
                this.downloadPath = folderPath
                document.getElementById('selectedLocation').textContent = `Download to: ${folderPath}`
                document.getElementById('startDownload').disabled = false
                this.addLogEntry(`Download location set: ${folderPath}`, 'info')
            }
        } catch (error) {
            this.addLogEntry(`Error selecting location: ${error.message}`, 'error')
        }
    }

    async startDownload() {
        if (!this.torrentPath || !this.downloadPath) {
            this.addLogEntry('Please select both torrent file and download location', 'error')
            return
        }

        try {
            document.getElementById('startDownload').disabled = true
            document.getElementById('progressSection').style.display = 'block'
            
            this.addLogEntry('Starting download...', 'info')
            
            const result = await window.electronAPI.startDownload(this.torrentPath, this.downloadPath)
            
            if (result.success) {
                this.addLogEntry('Download started successfully!', 'success')
            } else {
                this.addLogEntry(`Download failed: ${result.error}`, 'error')
                document.getElementById('startDownload').disabled = false
            }
        } catch (error) {
            this.addLogEntry(`Error starting download: ${error.message}`, 'error')
            document.getElementById('startDownload').disabled = false
        }
    }

    updateProgress(progress) {
        const { percentage, speed, peers, downloaded, total } = progress
        
        document.getElementById('progressFill').style.width = `${percentage}%`
        document.getElementById('progressText').textContent = `${percentage.toFixed(1)}%`
        document.getElementById('speedText').textContent = `${this.formatSpeed(speed)}`
        document.getElementById('peersText').textContent = `${peers} peers`
        
        this.addLogEntry(`Progress: ${percentage.toFixed(1)}% - ${this.formatBytes(downloaded)}/${this.formatBytes(total)}`, 'info')
    }

    addLogEntry(message, type = 'info') {
        const logContainer = document.getElementById('logContainer')
        const entry = document.createElement('div')
        entry.className = `log-entry ${type}`
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`
        
        logContainer.appendChild(entry)
        logContainer.scrollTop = logContainer.scrollHeight
    }

    formatSpeed(bytesPerSecond) {
        if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`
        if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
        return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
    }

    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
}

// Initialize the GUI when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BitTorrentGUI()
})